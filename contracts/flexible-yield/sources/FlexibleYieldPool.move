/// FlexibleYieldPool - Mobile flexible pool with per-deposit ticket accounting.
///
/// The pool custodies bridge AET in a controller resource account and exposes
/// only internal accounting shares to users. Tickets preserve deposit-time
/// metadata so performance fees are charged only on realized yield above the
/// time-weighted target APY.
module aptree::FlexibleYieldPool {
    use std::option::{Self, Option};
    use std::signer::address_of;
    use std::vector;
    use aptos_framework::account::{Self, SignerCapability};
    use aptos_framework::event::emit;
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::object;
    use aptos_framework::primary_fungible_store;
    use aptos_framework::timestamp;

    use aptree::moneyfi_adapter as MoneyFiBridge;

    const SEED: vector<u8> = b"FlexibleYieldPoolController";

    /// Internal share / NAV precision. Chosen at 1e18 to make ticket math
    /// dust-resistant (see H6). All internal share accounting uses this.
    const SHARE_SCALE: u128 = 1_000_000_000_000_000_000;
    /// AET scale used by the bridge for lp_price. Must match
    /// `aptree::moneyfi_adapter::AET_SCALE` (1e9). Used only for bridge
    /// boundary conversions, never for internal share math.
    const AET_SCALE: u128 = 1_000_000_000;
    const BPS_DENOMINATOR: u128 = 10_000;
    const YEAR_SECONDS: u128 = 31_536_000;

    const DEFAULT_TARGET_APY_BPS: u64 = 1_000;
    const DEFAULT_PERFORMANCE_FEE_BPS: u64 = 2_000;
    const DEFAULT_MIN_DEPOSIT: u64 = 1_000000;
    const DEFAULT_MAX_TARGET_APY_BPS: u64 = 1_000;

    const EZERO_AMOUNT: u64 = 401;
    const ENOT_ADMIN: u64 = 402;
    const EDEPOSITS_DISABLED: u64 = 403;
    const EBELOW_MINIMUM_DEPOSIT: u64 = 404;
    const ESLIPPAGE_EXCEEDED: u64 = 405;
    const EZERO_SHARES: u64 = 406;
    const EINSUFFICIENT_BALANCE: u64 = 407;
    const EPENDING_NOT_FOUND: u64 = 408;
    const EINVALID_ADDRESS: u64 = 409;
    const EINVALID_BPS: u64 = 410;
    const ENOT_PENDING_ADMIN: u64 = 411;
    const ENO_PENDING_ADMIN: u64 = 412;
    const EWITHDRAWALS_DISABLED: u64 = 413;
    const ETARGET_EXCEEDS_CAP: u64 = 414;

    struct FlexiblePoolConfig has key {
        signer_cap: SignerCapability,
        admin: address,
        pending_admin: Option<address>,
        treasury: address,
        target_apy_bps: u64,
        max_target_apy_bps: u64,
        performance_fee_bps: u64,
        deposits_enabled: bool,
        withdrawals_enabled: bool,
        min_deposit_amount: u64,
        total_internal_shares: u64,
        total_aet_held: u64,
        total_principal: u64,
        total_pending_gross: u64,
        total_fees_collected: u64
    }

    struct Ticket has store, drop, copy {
        id: u64,
        shares: u64,
        principal: u64,
        entry_nav: u128,
        entry_time: u64,
        target_apy_bps: u64
    }

    struct UserFlexibleTickets has key {
        tickets: vector<Ticket>,
        next_ticket_id: u64,
        fifo_cursor: u64
    }

    struct PendingWithdrawal has store, drop, copy {
        pending_id: u64,
        gross_amount: u64,
        user_receives: u64,
        fee: u64,
        principal_portion: u64,
        shares_burned: u64,
        requested_at: u64
    }

    struct UserPendingWithdrawals has key {
        pending: vector<PendingWithdrawal>,
        next_pending_id: u64
    }

    #[event]
    struct FlexibleDeposit has drop, store {
        user: address,
        ticket_id: u64,
        amount: u64,
        shares: u64,
        nav: u128,
        target_apy_bps: u64,
        timestamp: u64
    }

    #[event]
    struct FlexibleWithdrawRequested has drop, store {
        user: address,
        pending_id: u64,
        gross_amount: u64,
        user_receives: u64,
        fee: u64,
        principal_portion: u64,
        shares_burned: u64,
        timestamp: u64
    }

    #[event]
    struct FlexibleWithdrawCompleted has drop, store {
        user: address,
        pending_id: u64,
        gross_amount: u64,
        user_receives: u64,
        fee: u64,
        timestamp: u64
    }

    #[event]
    struct FlexibleConfigUpdated has drop, store {
        field: u8,
        old_value: u64,
        new_value: u64,
        timestamp: u64
    }

    #[event]
    struct FlexibleTreasuryUpdated has drop, store {
        old_treasury: address,
        new_treasury: address,
        timestamp: u64
    }

    #[event]
    struct FlexibleDepositsToggled has drop, store {
        enabled: bool,
        timestamp: u64
    }

    #[event]
    struct FlexibleWithdrawalsToggled has drop, store {
        enabled: bool,
        timestamp: u64
    }

    #[event]
    struct FlexibleAdminProposed has drop, store {
        current_admin: address,
        proposed_admin: address,
        timestamp: u64
    }

    #[event]
    struct FlexibleAdminTransferred has drop, store {
        old_admin: address,
        new_admin: address,
        timestamp: u64
    }

    fun init_module(admin: &signer) {
        let (controller_signer, signer_cap) =
            account::create_resource_account(admin, SEED);

        move_to(
            &controller_signer,
            FlexiblePoolConfig {
                signer_cap,
                admin: address_of(admin),
                pending_admin: option::none(),
                treasury: address_of(admin),
                target_apy_bps: DEFAULT_TARGET_APY_BPS,
                max_target_apy_bps: DEFAULT_MAX_TARGET_APY_BPS,
                performance_fee_bps: DEFAULT_PERFORMANCE_FEE_BPS,
                deposits_enabled: true,
                withdrawals_enabled: true,
                min_deposit_amount: DEFAULT_MIN_DEPOSIT,
                total_internal_shares: 0,
                total_aet_held: 0,
                total_principal: 0,
                total_pending_gross: 0,
                total_fees_collected: 0
            }
        );
    }

    public entry fun deposit(
        user: &signer,
        amount: u64,
        min_pool_shares: u64
    ) acquires FlexiblePoolConfig, UserFlexibleTickets {
        assert!(amount > 0, EZERO_AMOUNT);

        let config_addr = get_config_address();
        let config = borrow_global_mut<FlexiblePoolConfig>(config_addr);
        assert!(config.deposits_enabled, EDEPOSITS_DISABLED);
        assert!(amount >= config.min_deposit_amount, EBELOW_MINIMUM_DEPOSIT);

        let nav = get_pool_nav_internal(config);
        let shares = (((amount as u128) * SHARE_SCALE) / nav) as u64;
        assert!(shares > 0, EZERO_SHARES);
        assert!(shares >= min_pool_shares, ESLIPPAGE_EXCEEDED);

        let lp_price = MoneyFiBridge::get_lp_price();
        let expected_aet = (((amount as u128) * AET_SCALE) / lp_price) as u64;
        assert!(expected_aet > 0, EZERO_SHARES);

        let token_metadata =
            object::address_to_object<Metadata>(MoneyFiBridge::get_supported_token());
        primary_fungible_store::transfer(user, token_metadata, config_addr, amount);

        let controller_signer =
            account::create_signer_with_capability(&config.signer_cap);
        MoneyFiBridge::deposit(&controller_signer, amount);

        let user_addr = address_of(user);
        if (!exists<UserFlexibleTickets>(user_addr)) {
            move_to(
                user,
                UserFlexibleTickets {
                    tickets: vector::empty(),
                    next_ticket_id: 1,
                    fifo_cursor: 0
                }
            );
        };

        let user_tickets = borrow_global_mut<UserFlexibleTickets>(user_addr);
        let ticket_id = user_tickets.next_ticket_id;
        user_tickets.next_ticket_id = ticket_id + 1;
        user_tickets.tickets.push_back(
            Ticket {
                id: ticket_id,
                shares,
                principal: amount,
                entry_nav: nav,
                entry_time: timestamp::now_seconds(),
                target_apy_bps: config.target_apy_bps
            }
        );

        config.total_internal_shares += shares;
        config.total_aet_held += expected_aet;
        config.total_principal += amount;

        emit(
            FlexibleDeposit {
                user: user_addr,
                ticket_id,
                amount,
                shares,
                nav,
                target_apy_bps: config.target_apy_bps,
                timestamp: timestamp::now_seconds()
            }
        );
    }

    public entry fun request_withdraw(
        user: &signer,
        gross_amount: u64,
        min_lp_price: u128
    ) acquires FlexiblePoolConfig, UserFlexibleTickets, UserPendingWithdrawals {
        assert!(gross_amount > 0, EZERO_AMOUNT);

        let user_addr = address_of(user);
        assert!(exists<UserFlexibleTickets>(user_addr), EINSUFFICIENT_BALANCE);

        let lp_price = MoneyFiBridge::get_lp_price();
        assert!(lp_price >= min_lp_price, ESLIPPAGE_EXCEEDED);

        let config_addr = get_config_address();
        let config = borrow_global_mut<FlexiblePoolConfig>(config_addr);
        assert!(config.withdrawals_enabled, EWITHDRAWALS_DISABLED);
        let nav = get_pool_nav_internal(config);

        let remaining = gross_amount;
        let total_user_receives = 0;
        let total_fee = 0;
        let total_principal_portion = 0;
        let total_shares_burned = 0;
        let current_time = timestamp::now_seconds();

        let user_tickets = borrow_global_mut<UserFlexibleTickets>(user_addr);

        while (remaining > 0 && user_tickets.fifo_cursor < user_tickets.tickets.length()) {
            let index = user_tickets.fifo_cursor;
            let ticket = *user_tickets.tickets.borrow(index);

            // Drained tickets are left in place (indexer keeps history). Skip
            // them by advancing the cursor so the loop stays O(n) over live
            // tickets and FIFO ordering is preserved.
            if (ticket.shares == 0) {
                user_tickets.fifo_cursor = user_tickets.fifo_cursor + 1;
                continue
            };

            let ticket_value = shares_to_value(ticket.shares, nav);
            let full_ticket = ticket_value <= remaining;
            let gross_from_ticket =
                if (full_ticket) {
                    ticket_value
                } else {
                    remaining
                };
            let shares_to_burn =
                if (full_ticket) {
                    ticket.shares
                } else {
                    value_to_shares_round_up(gross_from_ticket, nav)
                };
            assert!(shares_to_burn > 0 && shares_to_burn <= ticket.shares, EZERO_SHARES);

            let (
                _actual_profit,
                _target_profit,
                _excess_profit,
                fee,
                principal_portion
            ) = calculate_ticket_withdrawal(
                &ticket,
                shares_to_burn,
                gross_from_ticket,
                current_time,
                config.performance_fee_bps
            );

            total_user_receives += gross_from_ticket - fee;
            total_fee += fee;
            total_principal_portion += principal_portion;
            total_shares_burned += shares_to_burn;
            remaining -= gross_from_ticket;

            if (shares_to_burn == ticket.shares) {
                // Drain in place and advance cursor; vector is append-only.
                let ticket_mut = user_tickets.tickets.borrow_mut(index);
                ticket_mut.shares = 0;
                ticket_mut.principal = 0;
                user_tickets.fifo_cursor = user_tickets.fifo_cursor + 1;
            } else {
                let ticket_mut = user_tickets.tickets.borrow_mut(index);
                ticket_mut.shares = ticket_mut.shares - shares_to_burn;
                ticket_mut.principal = ticket_mut.principal - principal_portion;
            };
        };

        assert!(remaining == 0, EINSUFFICIENT_BALANCE);

        let aet_to_burn = (((gross_amount as u128) * AET_SCALE) / lp_price) as u64;
        assert!(aet_to_burn > 0 && aet_to_burn <= config.total_aet_held, EINSUFFICIENT_BALANCE);

        let controller_signer =
            account::create_signer_with_capability(&config.signer_cap);
        MoneyFiBridge::request(&controller_signer, gross_amount, min_lp_price);

        if (!exists<UserPendingWithdrawals>(user_addr)) {
            move_to(
                user,
                UserPendingWithdrawals {
                    pending: vector::empty(),
                    next_pending_id: 1
                }
            );
        };

        let user_pending = borrow_global_mut<UserPendingWithdrawals>(user_addr);
        let pending_id = user_pending.next_pending_id;
        user_pending.next_pending_id = pending_id + 1;
        user_pending.pending.push_back(
            PendingWithdrawal {
                pending_id,
                gross_amount,
                user_receives: total_user_receives,
                fee: total_fee,
                principal_portion: total_principal_portion,
                shares_burned: total_shares_burned,
                requested_at: current_time
            }
        );

        config.total_internal_shares -= total_shares_burned;
        config.total_aet_held -= aet_to_burn;
        config.total_principal -= total_principal_portion;
        config.total_pending_gross += gross_amount;

        emit(
            FlexibleWithdrawRequested {
                user: user_addr,
                pending_id,
                gross_amount,
                user_receives: total_user_receives,
                fee: total_fee,
                principal_portion: total_principal_portion,
                shares_burned: total_shares_burned,
                timestamp: current_time
            }
        );
    }

    public entry fun complete_withdraw(
        user: &signer,
        pending_id: u64
    ) acquires FlexiblePoolConfig, UserPendingWithdrawals {
        let user_addr = address_of(user);
        assert!(exists<UserPendingWithdrawals>(user_addr), EPENDING_NOT_FOUND);

        let user_pending = borrow_global_mut<UserPendingWithdrawals>(user_addr);
        let (found, index) = find_pending_index(&user_pending.pending, pending_id);
        assert!(found, EPENDING_NOT_FOUND);

        let pending = user_pending.pending[index];
        let config_addr = get_config_address();
        let config = borrow_global_mut<FlexiblePoolConfig>(config_addr);
        let controller_signer =
            account::create_signer_with_capability(&config.signer_cap);

        MoneyFiBridge::withdraw(&controller_signer, pending.gross_amount);

        let token_metadata =
            object::address_to_object<Metadata>(MoneyFiBridge::get_supported_token());
        if (pending.user_receives > 0) {
            primary_fungible_store::transfer(
                &controller_signer,
                token_metadata,
                user_addr,
                pending.user_receives
            );
        };
        if (pending.fee > 0) {
            primary_fungible_store::transfer(
                &controller_signer,
                token_metadata,
                config.treasury,
                pending.fee
            );
            config.total_fees_collected += pending.fee;
        };

        config.total_pending_gross -= pending.gross_amount;
        user_pending.pending.remove(index);

        emit(
            FlexibleWithdrawCompleted {
                user: user_addr,
                pending_id,
                gross_amount: pending.gross_amount,
                user_receives: pending.user_receives,
                fee: pending.fee,
                timestamp: timestamp::now_seconds()
            }
        );
    }

    public entry fun set_target_apy_bps(
        admin: &signer,
        new_target_apy_bps: u64
    ) acquires FlexiblePoolConfig {
        let config = borrow_global_mut<FlexiblePoolConfig>(get_config_address());
        assert!(address_of(admin) == config.admin, ENOT_ADMIN);
        assert!(new_target_apy_bps <= config.max_target_apy_bps, ETARGET_EXCEEDS_CAP);

        let old_value = config.target_apy_bps;
        config.target_apy_bps = new_target_apy_bps;
        emit(
            FlexibleConfigUpdated {
                field: 1,
                old_value,
                new_value: new_target_apy_bps,
                timestamp: timestamp::now_seconds()
            }
        );
    }

    public entry fun set_max_target_apy_bps(
        admin: &signer,
        new_max_target_apy_bps: u64
    ) acquires FlexiblePoolConfig {
        let config = borrow_global_mut<FlexiblePoolConfig>(get_config_address());
        assert!(address_of(admin) == config.admin, ENOT_ADMIN);
        assert!((new_max_target_apy_bps as u128) <= BPS_DENOMINATOR, EINVALID_BPS);

        let old_value = config.max_target_apy_bps;
        config.max_target_apy_bps = new_max_target_apy_bps;
        // Lowering the cap also clamps the active target so it never sits
        // above the cap.
        if (config.target_apy_bps > new_max_target_apy_bps) {
            config.target_apy_bps = new_max_target_apy_bps;
        };
        emit(
            FlexibleConfigUpdated {
                field: 4,
                old_value,
                new_value: new_max_target_apy_bps,
                timestamp: timestamp::now_seconds()
            }
        );
    }

    public entry fun set_performance_fee_bps(
        admin: &signer,
        new_performance_fee_bps: u64
    ) acquires FlexiblePoolConfig {
        let config = borrow_global_mut<FlexiblePoolConfig>(get_config_address());
        assert!(address_of(admin) == config.admin, ENOT_ADMIN);
        assert!((new_performance_fee_bps as u128) <= BPS_DENOMINATOR, EINVALID_BPS);

        let old_value = config.performance_fee_bps;
        config.performance_fee_bps = new_performance_fee_bps;
        emit(
            FlexibleConfigUpdated {
                field: 2,
                old_value,
                new_value: new_performance_fee_bps,
                timestamp: timestamp::now_seconds()
            }
        );
    }

    public entry fun set_treasury(
        admin: &signer,
        new_treasury: address
    ) acquires FlexiblePoolConfig {
        let config = borrow_global_mut<FlexiblePoolConfig>(get_config_address());
        assert!(address_of(admin) == config.admin, ENOT_ADMIN);
        assert!(new_treasury != @0x0, EINVALID_ADDRESS);

        let old_treasury = config.treasury;
        config.treasury = new_treasury;
        emit(
            FlexibleTreasuryUpdated {
                old_treasury,
                new_treasury,
                timestamp: timestamp::now_seconds()
            }
        );
    }

    public entry fun set_deposits_enabled(
        admin: &signer,
        enabled: bool
    ) acquires FlexiblePoolConfig {
        let config = borrow_global_mut<FlexiblePoolConfig>(get_config_address());
        assert!(address_of(admin) == config.admin, ENOT_ADMIN);
        config.deposits_enabled = enabled;
        emit(FlexibleDepositsToggled { enabled, timestamp: timestamp::now_seconds() });
    }

    /// Pause/unpause new withdrawal requests. Does not affect in-flight
    /// pending withdrawals — `complete_withdraw` always remains callable so
    /// users can settle requests that were already submitted to the bridge.
    public entry fun set_withdrawals_enabled(
        admin: &signer,
        enabled: bool
    ) acquires FlexiblePoolConfig {
        let config = borrow_global_mut<FlexiblePoolConfig>(get_config_address());
        assert!(address_of(admin) == config.admin, ENOT_ADMIN);
        config.withdrawals_enabled = enabled;
        emit(
            FlexibleWithdrawalsToggled { enabled, timestamp: timestamp::now_seconds() }
        );
    }

    /// Two-step admin rotation: propose a new admin. The candidate must
    /// then call `accept_admin` to take ownership.
    public entry fun propose_admin(
        admin: &signer,
        new_admin: address
    ) acquires FlexiblePoolConfig {
        let config = borrow_global_mut<FlexiblePoolConfig>(get_config_address());
        assert!(address_of(admin) == config.admin, ENOT_ADMIN);
        assert!(new_admin != @0x0, EINVALID_ADDRESS);

        config.pending_admin = option::some(new_admin);
        emit(
            FlexibleAdminProposed {
                current_admin: config.admin,
                proposed_admin: new_admin,
                timestamp: timestamp::now_seconds()
            }
        );
    }

    public entry fun accept_admin(new_admin: &signer) acquires FlexiblePoolConfig {
        let config = borrow_global_mut<FlexiblePoolConfig>(get_config_address());
        assert!(config.pending_admin.is_some(), ENO_PENDING_ADMIN);
        assert!(
            address_of(new_admin) == *config.pending_admin.borrow(),
            ENOT_PENDING_ADMIN
        );

        let old_admin = config.admin;
        config.admin = address_of(new_admin);
        config.pending_admin = option::none();
        emit(
            FlexibleAdminTransferred {
                old_admin,
                new_admin: address_of(new_admin),
                timestamp: timestamp::now_seconds()
            }
        );
    }

    public entry fun set_min_deposit(
        admin: &signer,
        new_min_deposit: u64
    ) acquires FlexiblePoolConfig {
        let config = borrow_global_mut<FlexiblePoolConfig>(get_config_address());
        assert!(address_of(admin) == config.admin, ENOT_ADMIN);

        let old_value = config.min_deposit_amount;
        config.min_deposit_amount = new_min_deposit;
        emit(
            FlexibleConfigUpdated {
                field: 3,
                old_value,
                new_value: new_min_deposit,
                timestamp: timestamp::now_seconds()
            }
        );
    }

    #[view]
    public fun get_user_tickets(user: address): vector<Ticket> acquires UserFlexibleTickets {
        if (!exists<UserFlexibleTickets>(user)) {
            return vector::empty()
        };
        borrow_global<UserFlexibleTickets>(user).tickets
    }

    #[view]
    public fun get_pending_withdrawals(
        user: address
    ): vector<PendingWithdrawal> acquires UserPendingWithdrawals {
        if (!exists<UserPendingWithdrawals>(user)) {
            return vector::empty()
        };
        borrow_global<UserPendingWithdrawals>(user).pending
    }

    #[view]
    public fun get_pool_nav(): u128 acquires FlexiblePoolConfig {
        let config = borrow_global<FlexiblePoolConfig>(get_config_address());
        get_pool_nav_internal(config)
    }

    #[view]
    public fun get_pool_value(): u64 acquires FlexiblePoolConfig {
        let config = borrow_global<FlexiblePoolConfig>(get_config_address());
        get_pool_value_internal(config)
    }

    #[view]
    public fun get_protocol_stats(): (
        u64,
        u64,
        u64,
        u64,
        u64,
        u64,
        u64
    ) acquires FlexiblePoolConfig {
        let config = borrow_global<FlexiblePoolConfig>(get_config_address());
        (
            config.total_internal_shares,
            config.total_aet_held,
            config.total_principal,
            config.total_pending_gross,
            config.total_fees_collected,
            config.target_apy_bps,
            config.performance_fee_bps
        )
    }

    #[view]
    public fun preview_withdrawal(
        user: address,
        gross_amount: u64
    ): (u64, u64, u64, u64, u64, u64, u64, u64) acquires FlexiblePoolConfig, UserFlexibleTickets {
        if (gross_amount == 0 || !exists<UserFlexibleTickets>(user)) {
            return (0, 0, 0, 0, 0, 0, 0, 0)
        };

        let config = borrow_global<FlexiblePoolConfig>(get_config_address());
        let nav = get_pool_nav_internal(config);
        let user_tickets = borrow_global<UserFlexibleTickets>(user);
        let current_time = timestamp::now_seconds();

        let remaining = gross_amount;
        let total_gross = 0;
        let total_principal = 0;
        let total_actual_profit = 0;
        let total_target_profit = 0;
        let total_excess_profit = 0;
        let total_fee = 0;
        let total_shares = 0;
        let i = user_tickets.fifo_cursor;

        while (remaining > 0 && i < user_tickets.tickets.length()) {
            let ticket = *user_tickets.tickets.borrow(i);
            if (ticket.shares > 0) {
                let ticket_value = shares_to_value(ticket.shares, nav);
                let full_ticket = ticket_value <= remaining;
                let gross_from_ticket = if (full_ticket) { ticket_value } else { remaining };
                let shares_to_burn =
                    if (full_ticket) {
                        ticket.shares
                    } else {
                        value_to_shares_round_up(gross_from_ticket, nav)
                    };

                if (shares_to_burn > 0 && shares_to_burn <= ticket.shares) {
                    let (
                        actual_profit,
                        target_profit,
                        excess_profit,
                        fee,
                        principal_portion
                    ) = calculate_ticket_withdrawal(
                        &ticket,
                        shares_to_burn,
                        gross_from_ticket,
                        current_time,
                        config.performance_fee_bps
                    );

                    total_gross += gross_from_ticket;
                    total_principal += principal_portion;
                    total_actual_profit += actual_profit;
                    total_target_profit += target_profit;
                    total_excess_profit += excess_profit;
                    total_fee += fee;
                    total_shares += shares_to_burn;
                    remaining -= gross_from_ticket;
                } else {
                    return (total_gross, total_principal, total_actual_profit, total_target_profit, total_excess_profit, total_fee, total_gross - total_fee, total_shares)
                };
            };
            i += 1;
        };

        (total_gross, total_principal, total_actual_profit, total_target_profit, total_excess_profit, total_fee, total_gross - total_fee, total_shares)
    }

    #[view]
    public fun get_treasury(): address acquires FlexiblePoolConfig {
        borrow_global<FlexiblePoolConfig>(get_config_address()).treasury
    }

    #[view]
    public fun are_deposits_enabled(): bool acquires FlexiblePoolConfig {
        borrow_global<FlexiblePoolConfig>(get_config_address()).deposits_enabled
    }

    #[view]
    public fun get_min_deposit(): u64 acquires FlexiblePoolConfig {
        borrow_global<FlexiblePoolConfig>(get_config_address()).min_deposit_amount
    }

    #[view]
    public fun are_withdrawals_enabled(): bool acquires FlexiblePoolConfig {
        borrow_global<FlexiblePoolConfig>(get_config_address()).withdrawals_enabled
    }

    #[view]
    public fun get_max_target_apy_bps(): u64 acquires FlexiblePoolConfig {
        borrow_global<FlexiblePoolConfig>(get_config_address()).max_target_apy_bps
    }

    #[view]
    public fun get_pending_admin(): Option<address> acquires FlexiblePoolConfig {
        borrow_global<FlexiblePoolConfig>(get_config_address()).pending_admin
    }

    #[view]
    public fun get_admin(): address acquires FlexiblePoolConfig {
        borrow_global<FlexiblePoolConfig>(get_config_address()).admin
    }

    fun get_config_address(): address {
        account::create_resource_address(&@aptree, SEED)
    }

    fun get_pool_nav_internal(config: &FlexiblePoolConfig): u128 {
        if (config.total_internal_shares == 0) {
            return SHARE_SCALE
        };

        let pool_value = get_pool_value_internal(config);
        let nav =
            ((pool_value as u128) * SHARE_SCALE) / (config.total_internal_shares as u128);
        if (nav == 0) { 1 } else { nav }
    }

    fun get_pool_value_internal(config: &FlexiblePoolConfig): u64 {
        let lp_price = MoneyFiBridge::get_lp_price();
        (((config.total_aet_held as u128) * lp_price) / AET_SCALE) as u64
    }

    fun shares_to_value(shares: u64, nav: u128): u64 {
        (((shares as u128) * nav) / SHARE_SCALE) as u64
    }

    fun value_to_shares_round_up(value: u64, nav: u128): u64 {
        let numerator = (value as u128) * SHARE_SCALE;
        let shares = numerator / nav;
        if (numerator % nav == 0) {
            shares as u64
        } else {
            (shares + 1) as u64
        }
    }

    fun calculate_ticket_withdrawal(
        ticket: &Ticket,
        shares_to_burn: u64,
        gross_value: u64,
        current_time: u64,
        performance_fee_bps: u64
    ): (u64, u64, u64, u64, u64) {
        let principal_portion =
            (((ticket.principal as u128) * (shares_to_burn as u128))
                / (ticket.shares as u128)) as u64;
        let actual_profit =
            if (gross_value > principal_portion) {
                gross_value - principal_portion
            } else { 0 };
        let duration = current_time - ticket.entry_time;
        let target_profit =
            (((principal_portion as u128)
                * (ticket.target_apy_bps as u128)
                * (duration as u128))
                / YEAR_SECONDS
                / BPS_DENOMINATOR) as u64;
        let excess_profit =
            if (actual_profit > target_profit) {
                actual_profit - target_profit
            } else { 0 };
        let fee =
            (((excess_profit as u128) * (performance_fee_bps as u128))
                / BPS_DENOMINATOR) as u64;

        (actual_profit, target_profit, excess_profit, fee, principal_portion)
    }

    fun find_pending_index(
        pending: &vector<PendingWithdrawal>,
        pending_id: u64
    ): (bool, u64) {
        let len = pending.length();
        let i = 0;
        while (i < len) {
            let p = pending.borrow(i);
            if (p.pending_id == pending_id) {
                return (true, i)
            };
            i += 1;
        };
        (false, 0)
    }

    #[test_only]
    public fun init_for_testing(admin: &signer) {
        init_module(admin);
    }

    #[test_only]
    public fun calculate_fee_for_testing(
        shares: u64,
        principal: u64,
        gross_value: u64,
        target_apy_bps: u64,
        duration: u64,
        performance_fee_bps: u64
    ): (u64, u64, u64, u64, u64) {
        let ticket = Ticket {
            id: 1,
            shares,
            principal,
            entry_nav: SHARE_SCALE,
            entry_time: 0,
            target_apy_bps
        };
        calculate_ticket_withdrawal(
            &ticket,
            shares,
            gross_value,
            duration,
            performance_fee_bps
        )
    }

    #[test_only]
    public fun calculate_partial_fee_for_testing(
        ticket_shares: u64,
        shares_to_burn: u64,
        principal: u64,
        gross_value: u64,
        target_apy_bps: u64,
        duration: u64,
        performance_fee_bps: u64
    ): (u64, u64, u64, u64, u64) {
        let ticket = Ticket {
            id: 1,
            shares: ticket_shares,
            principal,
            entry_nav: SHARE_SCALE,
            entry_time: 0,
            target_apy_bps
        };
        calculate_ticket_withdrawal(
            &ticket,
            shares_to_burn,
            gross_value,
            duration,
            performance_fee_bps
        )
    }
}
