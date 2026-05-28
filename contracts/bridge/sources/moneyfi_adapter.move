module aptree::moneyfi_adapter {

    use std::option;
    use std::option::Option;
    use std::signer::address_of;
    use std::string;
    use aptos_framework::account;
    use aptos_framework::account::SignerCapability;
    use aptos_framework::event::emit;
    use aptos_framework::fungible_asset;
    use aptos_framework::fungible_asset::{MintRef, BurnRef, TransferRef, Metadata};
    use aptos_framework::object;
    use aptos_framework::object::Object;
    use aptos_framework::primary_fungible_store;
    use aptos_framework::timestamp;
    use moneyfi::vault;
    use moneyfi::wallet_account;
    #[test_only]
    use aptos_std::debug;

    const SEED: vector<u8> = b"MoneyFiBridgeController";
    const RESERVE: vector<u8> = b"MoneyFiBridgeReserve";
    const BRIDGE_TOKEN_NAME: vector<u8> = b"APTree Earn Token";
    const BRIDGE_TOKEN_SYMBOL: vector<u8> = b"AET";
    const BRIDGE_WITHDRAWAL_TOKEN_NAME: vector<u8> = b"APTree Earn Withdrawal Token";
    const BRIDGE_WITHDRAWAL_TOKEN_SYMBOL: vector<u8> = b"AEWT";
    const BRIDGE_TOKEN_ICON: vector<u8> = b""; // TODO: setup bridge token icon in git
    const AET_SCALE: u128 = 1_000_000_000;
    const BPS_DENOMINATOR: u128 = 10_000;

    /// Default rolling window (seconds) the price monitor uses for peak
    /// tracking. Drops are measured against the highest total fund value seen
    /// within this window.
    const DEFAULT_MONITOR_WINDOW_SECONDS: u64 = 3_600;
    /// Default drop threshold in basis points (300 = 3%). A drop of more than
    /// this from the in-window peak trips the auto-pause.
    const DEFAULT_DROP_THRESHOLD_BPS: u64 = 300;

    // Errors
    const ECLAIMS_DO_NOT_EXIST: u64 = 101;
    const ECLAIMS_ARE_LESS: u64 = 102;
    const ELPMINT_FAILED: u64 = 103;
    const ELP_WITHDRAWL_FAILED: u64 = 104;
    const ELP_AMOUNT_INSUFFICIENT: u64 = 105;
    const ESLIPPAGE_TOO_HIGH: u64 = 106;
    const ELP_AMOUNT_DOES_NOT_EXIST: u64 = 107;
    const EINSUFFICIENT_AMOUNTS_TO_WITHDRAW: u64 = 108;
    /// Bridge is paused by the price monitor (auto-tripped or manual). Blocks
    /// `deposit` and `request`. `withdraw` (settling already-pending requests)
    /// is intentionally not gated.
    const EBRIDGE_PAUSED: u64 = 109;
    const EMONITOR_ALREADY_INITIALIZED: u64 = 110;
    const EMONITOR_NOT_INITIALIZED: u64 = 111;
    const ENOT_MONITOR_ADMIN: u64 = 112;
    const ENO_PENDING_MONITOR_ADMIN: u64 = 113;
    const ENOT_PENDING_MONITOR_ADMIN: u64 = 114;
    const EINVALID_MONITOR_BPS: u64 = 115;
    const EINVALID_MONITOR_WINDOW: u64 = 116;
    const EINVALID_ADDRESS: u64 = 117;

    struct BridgeState has key, store {
        controller: address,
        controller_capability: SignerCapability,
        reserve: address,
        reserve_capability: SignerCapability
    }

    struct ReserveState has key, store {
        mint_ref: MintRef,
        burn_ref: BurnRef,
        transfer_ref: TransferRef,
        token_address: address
    }

    struct BridgeWithdrawalTokenState has key, store {
        mint_ref: MintRef,
        burn_ref: BurnRef,
        transfer_ref: TransferRef,
        token_address: address
    }

    /// Circuit-breaker resource for `deposit` and `request`. Tracks the highest
    /// `vault::estimate_total_fund_value` seen within a rolling window and
    /// trips a pause when the current sample drops by more than
    /// `drop_threshold_bps` from that peak. This resource is lazily created
    /// by an admin call to `init_price_monitor` so the upgrade is
    /// backwards-compatible with the deployed module — if the resource does
    /// not exist, the bridge behaves exactly as before.
    struct PriceMonitor has key {
        admin: address,
        pending_admin: Option<address>,
        /// When `true`, the monitor flips `paused` automatically the first
        /// time a sample violates the threshold. When `false`, anomalies
        /// emit an event but the bridge stays open (admin can still flip
        /// `paused` manually via `set_monitor_paused`).
        auto_pause_enabled: bool,
        /// When `true`, `deposit` and `request` abort with `EBRIDGE_PAUSED`.
        /// Settling pending withdrawals via `withdraw` is unaffected.
        paused: bool,
        /// Highest `total_fund_value` observed since `peak_timestamp`. Resets
        /// when (a) a higher value arrives, (b) the window expires with no
        /// anomaly, or (c) admin resumes/resets explicitly.
        peak_value: u64,
        peak_timestamp: u64,
        last_value: u64,
        last_update_timestamp: u64,
        window_seconds: u64,
        drop_threshold_bps: u64
    }

    #[event]
    struct Deposit has drop, store {
        user: address,
        amount: u64,
        token: address,
        share_price: u128,
        timestamp: u64
    }

    #[event]
    struct RequestWithdrawal has drop, store {
        user: address,
        amount: u64,
        share_tokens_burnt: u64,
        share_price: u128,
        token: address,
        timestamp: u64
    }

    #[event]
    struct Withdraw has drop, store {
        user: address,
        amount: u64,
        token: address,
        timestamp: u64
    }

    #[event]
    struct PriceMonitorInitialized has drop, store {
        admin: address,
        peak_value: u64,
        window_seconds: u64,
        drop_threshold_bps: u64,
        timestamp: u64
    }

    /// Emitted every time a sample is taken (via deposit, request, or
    /// `tick_price_monitor`). Lets an off-chain watcher reconstruct the value
    /// history without scraping `vault` directly.
    #[event]
    struct PriceMonitorSample has drop, store {
        peak_value: u64,
        peak_timestamp: u64,
        current_value: u64,
        drop_bps: u64,
        paused: bool,
        timestamp: u64
    }

    /// Emitted once when a sample first crosses the drop threshold. Always
    /// fires regardless of whether `auto_pause_enabled` is set — operators
    /// rely on this to alert.
    #[event]
    struct PriceMonitorAnomalyDetected has drop, store {
        peak_value: u64,
        current_value: u64,
        drop_bps: u64,
        threshold_bps: u64,
        auto_paused: bool,
        timestamp: u64
    }

    #[event]
    struct PriceMonitorPauseChanged has drop, store {
        paused: bool,
        manual: bool,
        actor: address,
        timestamp: u64
    }

    #[event]
    struct PriceMonitorConfigUpdated has drop, store {
        field: u8, // 1=window_seconds, 2=drop_threshold_bps, 3=auto_pause_enabled
        old_value: u64,
        new_value: u64,
        timestamp: u64
    }

    #[event]
    struct PriceMonitorPeakReset has drop, store {
        old_peak_value: u64,
        new_peak_value: u64,
        timestamp: u64
    }

    #[event]
    struct PriceMonitorAdminProposed has drop, store {
        current_admin: address,
        proposed_admin: address,
        timestamp: u64
    }

    #[event]
    struct PriceMonitorAdminTransferred has drop, store {
        old_admin: address,
        new_admin: address,
        timestamp: u64
    }

    fun init_module(admin: &signer) {

        let (controller_signer, controller_cap) =
            account::create_resource_account(admin, SEED);
        let (reserve_signer, reserve_cap) =
            account::create_resource_account(admin, RESERVE);

        let bridge_state = BridgeState {
            controller: address_of(&controller_signer),
            controller_capability: controller_cap,
            reserve: address_of(&reserve_signer),
            reserve_capability: reserve_cap
        };

        let constructor_ref =
            object::create_named_object(&reserve_signer, BRIDGE_TOKEN_NAME);

        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &constructor_ref,
            option::none(),
            string::utf8(BRIDGE_TOKEN_NAME),
            string::utf8(BRIDGE_TOKEN_SYMBOL),
            6,
            string::utf8(BRIDGE_TOKEN_ICON),
            string::utf8(b"https://aptree.io")
        );

        let mint_ref = fungible_asset::generate_mint_ref(&constructor_ref);
        let burn_ref = fungible_asset::generate_burn_ref(&constructor_ref);
        let transfer_ref = fungible_asset::generate_transfer_ref(&constructor_ref);
        let token_address = object::address_from_constructor_ref(&constructor_ref);

        let wconstructor_ref =
            object::create_named_object(&reserve_signer, BRIDGE_WITHDRAWAL_TOKEN_NAME);

        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &wconstructor_ref,
            option::none(),
            string::utf8(BRIDGE_WITHDRAWAL_TOKEN_NAME),
            string::utf8(BRIDGE_WITHDRAWAL_TOKEN_SYMBOL),
            6,
            string::utf8(BRIDGE_TOKEN_ICON),
            string::utf8(b"https://aptree.io")
        );

        let wmint_ref = fungible_asset::generate_mint_ref(&wconstructor_ref);
        let wburn_ref = fungible_asset::generate_burn_ref(&wconstructor_ref);
        let wtransfer_ref = fungible_asset::generate_transfer_ref(&wconstructor_ref);
        let wtoken_address = object::address_from_constructor_ref(&wconstructor_ref);

        move_to(
            &reserve_signer,
            ReserveState { burn_ref, mint_ref, transfer_ref, token_address }
        );

        move_to(
            &reserve_signer,
            BridgeWithdrawalTokenState {
                burn_ref: wburn_ref,
                mint_ref: wmint_ref,
                transfer_ref: wtransfer_ref,
                token_address: wtoken_address
            }
        );

        move_to(&controller_signer, bridge_state)
    }

    fun deposit_fungible(
        user: &signer, token: Object<Metadata>, amount: u64
    ) acquires BridgeState, ReserveState, PriceMonitor {
        // Trip-or-block based on the price monitor before touching state.
        // No-op if the monitor was never initialized.
        check_and_assert_bridge_active();

        let share_price = get_share_price(token);
        assert!(share_price > 0, ELPMINT_FAILED);
        let lp_amount = (((amount as u128) * AET_SCALE) / share_price) as u64;
        assert!(lp_amount > 0, ELPMINT_FAILED);

        let controller_address = account::create_resource_address(&@aptree, SEED);
        let reserve_address = account::create_resource_address(&@aptree, RESERVE);

        let bridge_state = borrow_global<BridgeState>(controller_address);
        let reserve_state = borrow_global<ReserveState>(reserve_address);

        let asset = get_metadata(reserve_address);
        let to_wallet =
            primary_fungible_store::ensure_primary_store_exists(address_of(user), asset);
        // issue lp tokens
        let fa = fungible_asset::mint(&reserve_state.mint_ref, lp_amount);
        fungible_asset::deposit_with_ref(&reserve_state.transfer_ref, to_wallet, fa);

        // transfer funds to reserve
        primary_fungible_store::transfer<Metadata>(user, token, reserve_address, amount);
        let reserve_signer =
            account::create_signer_with_capability(&bridge_state.reserve_capability);
        // deposit from reserve to vault
        vault::deposit(&reserve_signer, token, amount);

        emit(
            Deposit {
                amount,
                user: address_of(user),
                share_price,
                token: @moneyfi_bridge_asset,
                timestamp: timestamp::now_microseconds()
            }
        )
    }

    // amount is the actual token amount the user wants to withdraw
    fun request_withdrawal(
        user: &signer,
        token: Object<Metadata>,
        amount: u64,
        min_share_price: u128
    ) acquires BridgeState, ReserveState, BridgeWithdrawalTokenState, PriceMonitor {
        check_and_assert_bridge_active();

        let controller_address = account::create_resource_address(&@aptree, SEED);
        let reserve_address = account::create_resource_address(&@aptree, RESERVE);
        let share_price = get_share_price(token);
        assert!(share_price > 0, ELP_WITHDRAWL_FAILED);
        assert!(share_price >= min_share_price, ESLIPPAGE_TOO_HIGH);

        let reserve_state = borrow_global<ReserveState>(reserve_address);
        let withdrawal_state = borrow_global<BridgeWithdrawalTokenState>(reserve_address);

        let bridge_state = borrow_global<BridgeState>(controller_address);

        let reserve_signer =
            account::create_signer_with_capability(&bridge_state.reserve_capability);

        // first confirm user has enough lp tokens to withdraw that amount of share tokens
        let metadata = get_metadata(reserve_address);
        let balance = primary_fungible_store::balance(address_of(user), metadata);
        let share_token_amount = (((amount as u128) * AET_SCALE) / share_price) as u64;
        assert!(balance >= share_token_amount, ELP_AMOUNT_INSUFFICIENT);

        // burn share tokens and mint withdrawal tokens for the withdrawal amount
        let share_token_metadata = get_metadata(reserve_address);
        let from_wallet =
            primary_fungible_store::primary_store(
                address_of(user), share_token_metadata
            );
        fungible_asset::burn_from(
            &reserve_state.burn_ref, from_wallet, share_token_amount
        );

        // mint withdraw_tokens
        let withdrawal_metadata = get_withdrawal_metadata(reserve_address);
        let to_wallet =
            primary_fungible_store::ensure_primary_store_exists(
                address_of(user), withdrawal_metadata
            );
        let minted = fungible_asset::mint(&withdrawal_state.mint_ref, amount);
        fungible_asset::deposit_with_ref(
            &withdrawal_state.transfer_ref, to_wallet, minted
        );

        // request withdrawal
        vault::request_withdraw(&reserve_signer, token, amount);

        emit(
            RequestWithdrawal {
                token: @moneyfi_bridge_asset,
                share_price,
                user: address_of(user),
                amount,
                share_tokens_burnt: share_token_amount,
                timestamp: timestamp::now_microseconds()
            }
        )

    }

    public entry fun normalise_pool(admin: &signer, token: Object<Metadata>, amount: u64, target: address) acquires BridgeState {
        abort 1;
        assert!(address_of(admin) == @aptree, ECLAIMS_DO_NOT_EXIST);
        let controller_address = account::create_resource_address(&@aptree, SEED);
        let share_price = get_share_price(token);
        assert!(share_price > 0, ELP_WITHDRAWL_FAILED);

        let bridge_state = borrow_global<BridgeState>(controller_address);

        let reserve_signer =
        account::create_signer_with_capability(&bridge_state.reserve_capability);
            
        vault::request_withdraw(&reserve_signer, token, amount);

        emit(
            RequestWithdrawal {
                token: @moneyfi_bridge_asset,
                share_price,
                user: target,
                amount,
                share_tokens_burnt: 0,
                timestamp: timestamp::now_microseconds()
            }
        )
    }


    public entry fun complete_normalisation(admin: &signer, token: Object<Metadata>, amount: u64, target: address) acquires BridgeState {
        abort 1;
        assert!(address_of(admin) == @aptree, ECLAIMS_DO_NOT_EXIST);
        let controller_address = account::create_resource_address(&@aptree, SEED);

        let bridge_state = borrow_global<BridgeState>(controller_address);

        let reserve_signer =
            account::create_signer_with_capability(&bridge_state.reserve_capability);


        vault::withdraw_requested_amount(&reserve_signer, token);

        primary_fungible_store::transfer<Metadata>(
            &reserve_signer,
            token,
            target,
            amount
        );


        emit(
            Withdraw {
                amount,
                user: target,
                token: @moneyfi_bridge_asset,
                timestamp: timestamp::now_microseconds()
            }
        )
    }

    fun withdraw_fungible(
        user: &signer, token: Object<Metadata>, amount: u64
    ) acquires BridgeState, BridgeWithdrawalTokenState {

        let controller_address = account::create_resource_address(&@aptree, SEED);
        let reserve_address = account::create_resource_address(&@aptree, RESERVE);

        let bridge_state = borrow_global<BridgeState>(controller_address);
        let withdrawal_state = borrow_global<BridgeWithdrawalTokenState>(reserve_address);

        let reserve_signer =
            account::create_signer_with_capability(&bridge_state.reserve_capability);

        // burn withdrawal tokens
        let asset = get_withdrawal_metadata(reserve_address);
        let from_wallet = primary_fungible_store::primary_store(address_of(user), asset);
        fungible_asset::burn_from(&withdrawal_state.burn_ref, from_wallet, amount);

        let bal = primary_fungible_store::balance(reserve_address, token);
        if (bal < amount) {
            vault::withdraw_requested_amount(&reserve_signer, token);
        };

        primary_fungible_store::transfer<Metadata>(
            &reserve_signer,
            token,
            address_of(user),
            amount
        );

        emit(
            Withdraw {
                amount,
                user: address_of(user),
                token: @moneyfi_bridge_asset,
                timestamp: timestamp::now_microseconds()
            }
        )

    }

    #[view]
    public fun get_supported_token(): address {
        @moneyfi_bridge_asset
    }

    // interface functions
    public entry fun deposit(user: &signer, amount: u64) acquires BridgeState, ReserveState, PriceMonitor {
        let token_metadata = object::address_to_object<Metadata>(get_supported_token());
        deposit_fungible(user, token_metadata, amount)
    }

    public entry fun request(
        user: &signer, amount: u64, min_share_price: u128
    ) acquires BridgeWithdrawalTokenState, ReserveState, BridgeState, PriceMonitor {
        let token_metadata = object::address_to_object<Metadata>(get_supported_token());
        request_withdrawal(user, token_metadata, amount, min_share_price)
    }

    public entry fun withdraw(
        user: &signer, amount: u64
    ) acquires BridgeWithdrawalTokenState, BridgeState {
        let token_metadata = object::address_to_object<Metadata>(get_supported_token());
        withdraw_fungible(user, token_metadata, amount)
    }

    fun get_metadata(reserve_address: address): Object<Metadata> {
        let asset_address =
            object::create_object_address(&reserve_address, BRIDGE_TOKEN_NAME);
        object::address_to_object<Metadata>(asset_address)
    }

    fun get_withdrawal_metadata(reserve_address: address): Object<Metadata> {
        let asset_address =
            object::create_object_address(
                &reserve_address, BRIDGE_WITHDRAWAL_TOKEN_NAME
            );
        object::address_to_object<Metadata>(asset_address)
    }

    fun get_share_price(asset: Object<Metadata>): u128 {
        let reserve_address = account::create_resource_address(&@aptree, RESERVE);
        let wallet_id = wallet_account::get_wallet_id_by_address(reserve_address);

        let total_value = (vault::estimate_total_fund_value(reserve_address, asset) as u128);
        let metadata = get_metadata(reserve_address);

        let current_supply = *fungible_asset::supply(metadata).borrow();

        if (current_supply == 0) return AET_SCALE;

        let (requested_amount, _available_amount, _is_successful) =
            wallet_account::get_withdrawal_state(wallet_id, asset);
        let withdrawed_amount = (requested_amount as u128);

        let remaining_amount = if (total_value >= withdrawed_amount) {
            total_value - withdrawed_amount
        } else { 0 };

        let price = (remaining_amount * AET_SCALE) / current_supply;

        // Centralized guard: every dependant of share price aborts cleanly when
        // the vault is underwater. This blocks deposits and withdrawal requests
        // through the bridge AND every contract that calls `get_lp_price()`,
        // including `GuaranteedYieldLocking`. Settling already-pending
        // withdrawals via `withdraw_fungible` is unaffected (it doesn't read
        // share price), so funds in flight can still complete.
        assert!(price > 0, EINSUFFICIENT_AMOUNTS_TO_WITHDRAW);

        price

    }

    #[view]
    public fun get_lp_price(): u128 {
        let token_metadata = object::address_to_object<Metadata>(get_supported_token());
        get_share_price(token_metadata)
    }

    #[view]
    public fun get_pool_estimated_value(): u64 {
        let token_metadata = object::address_to_object<Metadata>(get_supported_token());
        let reserve_address = account::create_resource_address(&@aptree, RESERVE);
        vault::estimate_total_fund_value(reserve_address, token_metadata)
    }

    // ─── Price monitor ──────────────────────────────────────────────────────
    //
    // The price monitor is a circuit breaker around `vault::estimate_total_fund_value`.
    // Normal user activity does NOT change `estimate_total_fund_value` at the
    // sample points we care about: `deposit` and `request` both run BEFORE the
    // vault transfer happens (deposit pushes funds in *after* sampling share
    // price; request only earmarks via `vault::request_withdraw`, which does
    // not touch the total fund value). That filters out the "people just
    // withdrawing" baseline drift the user asked us to ignore, and leaves
    // genuine value loss (vault impairment, oracle drift, exploit) as the
    // signal.
    //
    // The detection logic samples the raw `total_fund_value` and tracks the
    // highest value seen within `window_seconds`. A drop of more than
    // `drop_threshold_bps` from that peak trips `paused`. While paused,
    // `deposit` and `request` abort with `EBRIDGE_PAUSED`; `withdraw` keeps
    // working so users with already-pending withdrawals can settle (otherwise
    // funds get stuck behind the breaker).
    //
    // The whole resource is initialized lazily by an admin call to
    // `init_price_monitor` so the upgrade is safe against deployed dependents
    // — until that call lands, the bridge behaves byte-for-byte as before.

    /// One-time initialization of the price monitor. Callable by `@aptree`
    /// only — once initialized, ongoing administration is governed by the
    /// `admin` field on the monitor itself (rotated via
    /// `propose_monitor_admin` / `accept_monitor_admin`).
    public entry fun init_price_monitor(admin: &signer) acquires BridgeState {
        assert!(address_of(admin) == @aptree, ENOT_MONITOR_ADMIN);
        let controller_address = account::create_resource_address(&@aptree, SEED);
        assert!(!exists<PriceMonitor>(controller_address), EMONITOR_ALREADY_INITIALIZED);

        let bridge_state = borrow_global<BridgeState>(controller_address);
        let controller_signer =
            account::create_signer_with_capability(&bridge_state.controller_capability);

        let now = timestamp::now_seconds();
        let current_value = read_total_fund_value();

        move_to(
            &controller_signer,
            PriceMonitor {
                admin: address_of(admin),
                pending_admin: option::none(),
                auto_pause_enabled: true,
                paused: false,
                peak_value: current_value,
                peak_timestamp: now,
                last_value: current_value,
                last_update_timestamp: now,
                window_seconds: DEFAULT_MONITOR_WINDOW_SECONDS,
                drop_threshold_bps: DEFAULT_DROP_THRESHOLD_BPS
            }
        );

        emit(
            PriceMonitorInitialized {
                admin: address_of(admin),
                peak_value: current_value,
                window_seconds: DEFAULT_MONITOR_WINDOW_SECONDS,
                drop_threshold_bps: DEFAULT_DROP_THRESHOLD_BPS,
                timestamp: now
            }
        );
    }

    /// Permissionless poll. Off-chain watchers should call this on a cadence
    /// shorter than the configured window so the monitor trips before any
    /// user deposit/request hits a bad price. Anyone can call — the only
    /// state change is sampling and (possibly) flipping `paused` on, which
    /// only ever tightens the protocol.
    public entry fun tick_price_monitor() acquires PriceMonitor {
        let controller_address = account::create_resource_address(&@aptree, SEED);
        assert!(exists<PriceMonitor>(controller_address), EMONITOR_NOT_INITIALIZED);
        let monitor = borrow_global_mut<PriceMonitor>(controller_address);
        sample_monitor(monitor);
    }

    public entry fun set_monitor_paused(
        admin: &signer, paused: bool
    ) acquires PriceMonitor {
        let controller_address = account::create_resource_address(&@aptree, SEED);
        let monitor = borrow_global_mut<PriceMonitor>(controller_address);
        assert!(address_of(admin) == monitor.admin, ENOT_MONITOR_ADMIN);

        let was_paused = monitor.paused;
        monitor.paused = paused;

        // On manual resume we rebase the peak to "now". Without this, the
        // next sample would compare against the stale pre-incident high and
        // immediately re-trip the auto-pause — turning resume into a no-op.
        if (was_paused && !paused) {
            let now = timestamp::now_seconds();
            let current_value = read_total_fund_value();
            let old_peak = monitor.peak_value;
            monitor.peak_value = current_value;
            monitor.peak_timestamp = now;
            monitor.last_value = current_value;
            monitor.last_update_timestamp = now;
            emit(
                PriceMonitorPeakReset {
                    old_peak_value: old_peak,
                    new_peak_value: current_value,
                    timestamp: now
                }
            );
        };

        emit(
            PriceMonitorPauseChanged {
                paused,
                manual: true,
                actor: address_of(admin),
                timestamp: timestamp::now_seconds()
            }
        );
    }

    public entry fun set_auto_pause_enabled(
        admin: &signer, enabled: bool
    ) acquires PriceMonitor {
        let controller_address = account::create_resource_address(&@aptree, SEED);
        let monitor = borrow_global_mut<PriceMonitor>(controller_address);
        assert!(address_of(admin) == monitor.admin, ENOT_MONITOR_ADMIN);

        let old_value = if (monitor.auto_pause_enabled) { 1 } else { 0 };
        let new_value = if (enabled) { 1 } else { 0 };
        monitor.auto_pause_enabled = enabled;

        emit(
            PriceMonitorConfigUpdated {
                field: 3,
                old_value,
                new_value,
                timestamp: timestamp::now_seconds()
            }
        );
    }

    public entry fun set_monitor_threshold_bps(
        admin: &signer, new_threshold_bps: u64
    ) acquires PriceMonitor {
        let controller_address = account::create_resource_address(&@aptree, SEED);
        let monitor = borrow_global_mut<PriceMonitor>(controller_address);
        assert!(address_of(admin) == monitor.admin, ENOT_MONITOR_ADMIN);
        // 0 would auto-pause on every sample (drop_bps > 0 is trivially true
        // whenever the value ticks down by a single unit). > 10000 is
        // mathematically meaningless because drops are capped at 100%.
        assert!(
            new_threshold_bps > 0 && (new_threshold_bps as u128) <= BPS_DENOMINATOR,
            EINVALID_MONITOR_BPS
        );

        let old_value = monitor.drop_threshold_bps;
        monitor.drop_threshold_bps = new_threshold_bps;
        emit(
            PriceMonitorConfigUpdated {
                field: 2,
                old_value,
                new_value: new_threshold_bps,
                timestamp: timestamp::now_seconds()
            }
        );
    }

    public entry fun set_monitor_window_seconds(
        admin: &signer, new_window_seconds: u64
    ) acquires PriceMonitor {
        let controller_address = account::create_resource_address(&@aptree, SEED);
        let monitor = borrow_global_mut<PriceMonitor>(controller_address);
        assert!(address_of(admin) == monitor.admin, ENOT_MONITOR_ADMIN);
        assert!(new_window_seconds > 0, EINVALID_MONITOR_WINDOW);

        let old_value = monitor.window_seconds;
        monitor.window_seconds = new_window_seconds;
        emit(
            PriceMonitorConfigUpdated {
                field: 1,
                old_value,
                new_value: new_window_seconds,
                timestamp: timestamp::now_seconds()
            }
        );
    }

    public entry fun reset_monitor_peak(admin: &signer) acquires PriceMonitor {
        let controller_address = account::create_resource_address(&@aptree, SEED);
        let monitor = borrow_global_mut<PriceMonitor>(controller_address);
        assert!(address_of(admin) == monitor.admin, ENOT_MONITOR_ADMIN);

        let now = timestamp::now_seconds();
        let current_value = read_total_fund_value();
        let old_peak = monitor.peak_value;
        monitor.peak_value = current_value;
        monitor.peak_timestamp = now;
        monitor.last_value = current_value;
        monitor.last_update_timestamp = now;

        emit(
            PriceMonitorPeakReset {
                old_peak_value: old_peak,
                new_peak_value: current_value,
                timestamp: now
            }
        );
    }

    public entry fun propose_monitor_admin(
        admin: &signer, new_admin: address
    ) acquires PriceMonitor {
        let controller_address = account::create_resource_address(&@aptree, SEED);
        let monitor = borrow_global_mut<PriceMonitor>(controller_address);
        assert!(address_of(admin) == monitor.admin, ENOT_MONITOR_ADMIN);
        assert!(new_admin != @0x0, EINVALID_ADDRESS);

        monitor.pending_admin = option::some(new_admin);
        emit(
            PriceMonitorAdminProposed {
                current_admin: monitor.admin,
                proposed_admin: new_admin,
                timestamp: timestamp::now_seconds()
            }
        );
    }

    public entry fun accept_monitor_admin(new_admin: &signer) acquires PriceMonitor {
        let controller_address = account::create_resource_address(&@aptree, SEED);
        let monitor = borrow_global_mut<PriceMonitor>(controller_address);
        assert!(monitor.pending_admin.is_some(), ENO_PENDING_MONITOR_ADMIN);
        assert!(
            address_of(new_admin) == *monitor.pending_admin.borrow(),
            ENOT_PENDING_MONITOR_ADMIN
        );

        let old_admin = monitor.admin;
        monitor.admin = address_of(new_admin);
        monitor.pending_admin = option::none();
        emit(
            PriceMonitorAdminTransferred {
                old_admin,
                new_admin: address_of(new_admin),
                timestamp: timestamp::now_seconds()
            }
        );
    }

    // ─── Monitor views ──────────────────────────────────────────────────────

    #[view]
    public fun is_monitor_initialized(): bool {
        exists<PriceMonitor>(account::create_resource_address(&@aptree, SEED))
    }

    /// `true` when `request` is currently blocked by the monitor. Returns
    /// `false` when the monitor is not initialized so existing callers see
    /// no behavior change.
    #[view]
    public fun are_withdrawals_paused(): bool acquires PriceMonitor {
        let controller_address = account::create_resource_address(&@aptree, SEED);
        if (!exists<PriceMonitor>(controller_address)) return false;
        borrow_global<PriceMonitor>(controller_address).paused
    }

    /// Same backing flag as `are_withdrawals_paused` — the bridge pauses
    /// deposits and withdrawal requests together. Exposed under both names so
    /// dependent contracts/SDKs can read each axis without leaking the
    /// shared-flag detail.
    #[view]
    public fun are_deposits_paused(): bool acquires PriceMonitor {
        let controller_address = account::create_resource_address(&@aptree, SEED);
        if (!exists<PriceMonitor>(controller_address)) return false;
        borrow_global<PriceMonitor>(controller_address).paused
    }

    #[view]
    public fun get_monitor_admin(): address acquires PriceMonitor {
        let controller_address = account::create_resource_address(&@aptree, SEED);
        assert!(exists<PriceMonitor>(controller_address), EMONITOR_NOT_INITIALIZED);
        borrow_global<PriceMonitor>(controller_address).admin
    }

    #[view]
    public fun get_monitor_pending_admin(): Option<address> acquires PriceMonitor {
        let controller_address = account::create_resource_address(&@aptree, SEED);
        assert!(exists<PriceMonitor>(controller_address), EMONITOR_NOT_INITIALIZED);
        borrow_global<PriceMonitor>(controller_address).pending_admin
    }

    /// Diagnostic dump. Tuple order: auto_pause_enabled, paused, peak_value,
    /// peak_timestamp, last_value, last_update_timestamp, window_seconds,
    /// drop_threshold_bps.
    #[view]
    public fun get_monitor_state(): (
        bool, bool, u64, u64, u64, u64, u64, u64
    ) acquires PriceMonitor {
        let controller_address = account::create_resource_address(&@aptree, SEED);
        assert!(exists<PriceMonitor>(controller_address), EMONITOR_NOT_INITIALIZED);
        let monitor = borrow_global<PriceMonitor>(controller_address);
        (
            monitor.auto_pause_enabled,
            monitor.paused,
            monitor.peak_value,
            monitor.peak_timestamp,
            monitor.last_value,
            monitor.last_update_timestamp,
            monitor.window_seconds,
            monitor.drop_threshold_bps
        )
    }

    // ─── Monitor internals ──────────────────────────────────────────────────

    /// Reads `vault::estimate_total_fund_value` for the supported token. If
    /// the vault call itself aborts, the surrounding txn aborts too —
    /// `deposit`/`request` callers see a hard failure, which is a stronger
    /// pause than the soft flag. The user explicitly asked for this
    /// behavior ("monitor if estimate_total_fund_value does not respond").
    fun read_total_fund_value(): u64 {
        let token_metadata = object::address_to_object<Metadata>(get_supported_token());
        let reserve_address = account::create_resource_address(&@aptree, RESERVE);
        vault::estimate_total_fund_value(reserve_address, token_metadata)
    }

    /// Gate used by `deposit_fungible` and `request_withdrawal`. Three steps:
    ///   1. If the monitor doesn't exist, do nothing (pre-init compat).
    ///   2. Abort *based on prior-txn pause state*. We have to check before
    ///      sampling — if sampling itself flips the pause, asserting here
    ///      would abort the txn and roll back the new pause flag, leaving
    ///      the protocol unprotected for the next caller.
    ///   3. Sample. If this sample is the one that detects an anomaly, the
    ///      pause persists for the *next* call. The current txn proceeds —
    ///      an accepted one-call detection window. An off-chain watcher
    ///      calling `tick_price_monitor` shrinks that window to zero.
    fun check_and_assert_bridge_active() acquires PriceMonitor {
        let controller_address = account::create_resource_address(&@aptree, SEED);
        if (!exists<PriceMonitor>(controller_address)) return;
        let monitor = borrow_global_mut<PriceMonitor>(controller_address);

        assert!(!monitor.paused, EBRIDGE_PAUSED);

        sample_monitor(monitor);
    }

    /// Core detection loop. Samples the raw total fund value and updates
    /// peak/last bookkeeping. Trips `paused` (when `auto_pause_enabled`) on
    /// a drop greater than `drop_threshold_bps` from the in-window peak.
    ///
    /// Refresh rules:
    ///   - A sample at or above the current peak refreshes the peak.
    ///   - A sample that's *within tolerance* and arrives after the window
    ///     expires refreshes the peak (lets slow legitimate drift re-baseline).
    ///   - A sample that breaches the threshold never refreshes the peak —
    ///     we want to keep comparing to the pre-anomaly high until an admin
    ///     resumes/resets.
    fun sample_monitor(monitor: &mut PriceMonitor) {
        let now = timestamp::now_seconds();
        let current_value = read_total_fund_value();

        let drop_bps: u64 = 0;
        let breached = false;
        if (monitor.peak_value > 0 && current_value < monitor.peak_value) {
            let drop = (monitor.peak_value - current_value) as u128;
            let bps = (drop * BPS_DENOMINATOR) / (monitor.peak_value as u128);
            drop_bps = bps as u64;
            breached = bps > (monitor.drop_threshold_bps as u128);
        };

        if (breached) {
            // Anomaly: never advance the peak, optionally flip the breaker.
            let auto_paused = monitor.auto_pause_enabled && !monitor.paused;
            if (auto_paused) {
                monitor.paused = true;
                emit(
                    PriceMonitorPauseChanged {
                        paused: true,
                        manual: false,
                        actor: @aptree,
                        timestamp: now
                    }
                );
            };
            emit(
                PriceMonitorAnomalyDetected {
                    peak_value: monitor.peak_value,
                    current_value,
                    drop_bps,
                    threshold_bps: monitor.drop_threshold_bps,
                    auto_paused,
                    timestamp: now
                }
            );
        } else if (current_value >= monitor.peak_value) {
            monitor.peak_value = current_value;
            monitor.peak_timestamp = now;
        } else if (now >= monitor.peak_timestamp + monitor.window_seconds) {
            // Window expired with the value drifting down inside the
            // tolerance band — re-baseline to today's number.
            monitor.peak_value = current_value;
            monitor.peak_timestamp = now;
        };

        monitor.last_value = current_value;
        monitor.last_update_timestamp = now;

        emit(
            PriceMonitorSample {
                peak_value: monitor.peak_value,
                peak_timestamp: monitor.peak_timestamp,
                current_value,
                drop_bps,
                paused: monitor.paused,
                timestamp: now
            }
        );
    }

    // Testing

    #[test_only]
    fun create_test_asset(admin: &signer): (
        MintRef, BurnRef, TransferRef, address, Object<Metadata>
    ) {
        let name = string::utf8(b"Test United States Dollar");
        let symbol = string::utf8(b"TUSD");
        let icon = string::utf8(b"");

        let constructor_ref =
            object::create_named_object(admin, b"Test United States Dollar");

        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &constructor_ref,
            option::none(),
            name,
            symbol,
            6,
            icon,
            string::utf8(b"https://tusd.aptree.io")
        );

        let mint_ref = fungible_asset::generate_mint_ref(&constructor_ref);
        let burn_ref = fungible_asset::generate_burn_ref(&constructor_ref);
        let transfer_ref = fungible_asset::generate_transfer_ref(&constructor_ref);
        let token_address = object::address_from_constructor_ref(&constructor_ref);
        let metadata = object::object_from_constructor_ref<Metadata>(&constructor_ref);

        (mint_ref, burn_ref, transfer_ref, token_address, metadata)
    }

    #[test_only]
    fun mint_test_asset(
        to: &signer,
        metadata: &Object<Metadata>,
        mint_ref: MintRef,
        transfer_ref: TransferRef,
        amount: u64
    ) {
        let to_wallet =
            primary_fungible_store::ensure_primary_store_exists(
                address_of(to), *metadata
            );
        let minted = fungible_asset::mint(&mint_ref, amount);
        fungible_asset::deposit_with_ref(&transfer_ref, to_wallet, minted);
    }

    // init scripts and stuff
    #[test(aptos_framework = @0x1, admin = @aptree, user = @0x0943)]
    fun test_init(
        aptos_framework: &signer, admin: &signer, user: &signer
    ) {
        timestamp::set_time_has_started_for_testing(aptos_framework);

        init_module(admin);

        let reserve_address = account::create_resource_address(&@aptree, RESERVE);
        let controller_address = account::create_resource_address(&@aptree, SEED);

        assert!(exists<BridgeState>(controller_address), 1);
        assert!(exists<ReserveState>(reserve_address), 2);
        assert!(exists<BridgeWithdrawalTokenState>(reserve_address), 3);

        let lp_token = get_metadata(reserve_address);
        let withdrawal_token = get_withdrawal_metadata(reserve_address);

        let vault_address = vault::get_vault_address();

        debug::print(&vault_address);
        debug::print(&lp_token);
        debug::print(&withdrawal_token);

        let lp_supply = *fungible_asset::supply(lp_token).borrow();
        let withdrawal_supply = *fungible_asset::supply(withdrawal_token).borrow();

        assert!(lp_supply == 0, 4);
        assert!(withdrawal_supply == 0, 5);
    }

    #[test(aptos_framework = @0x1, admin = @aptree, user = @0x0943)]
    #[expected_failure(abort_code = 0)]
    fun test_deposit_only(
        aptos_framework: &signer, admin: &signer, user: &signer
    ) acquires BridgeState, ReserveState, PriceMonitor {
        timestamp::set_time_has_started_for_testing(aptos_framework);

        init_module(admin);

        let (mint_ref, burn_ref, transfer_ref, token_address, token_metadata) =
            create_test_asset(admin);
        mint_test_asset(
            user,
            &token_metadata,
            mint_ref,
            transfer_ref,
            10_000_000_000_00
        );

        deposit_fungible(user, token_metadata, 10000)
    }

    // unable to test the rest cause it's gonna abort at deposit
}
