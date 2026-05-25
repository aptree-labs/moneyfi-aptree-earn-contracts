import {
  AccountAddressInput,
  InputEntryFunctionData,
  SimpleTransaction,
} from "@aptos-labs/ts-sdk";
import { BaseModule } from "../base-module";
import type {
  FlexibleCompleteWithdrawArgs,
  FlexibleDepositArgs,
  FlexibleProposeAdminArgs,
  FlexibleRequestWithdrawArgs,
  FlexibleSetDepositsEnabledArgs,
  FlexibleSetMaxTargetApyArgs,
  FlexibleSetMinDepositArgs,
  FlexibleSetPerformanceFeeArgs,
  FlexibleSetTargetApyArgs,
  FlexibleSetTreasuryArgs,
  FlexibleSetWithdrawalsEnabledArgs,
} from "../../types/flexible-yield";

export class FlexibleYieldBuilder extends BaseModule {
  async deposit(
    sender: AccountAddressInput,
    args: FlexibleDepositArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::FlexibleYieldPool::deposit`,
      [args.amount, args.minPoolShares],
    );
  }

  async requestWithdraw(
    sender: AccountAddressInput,
    args: FlexibleRequestWithdrawArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::FlexibleYieldPool::request_withdraw`,
      [args.grossAmount, args.minLpPrice],
    );
  }

  async completeWithdraw(
    sender: AccountAddressInput,
    args: FlexibleCompleteWithdrawArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::FlexibleYieldPool::complete_withdraw`,
      [args.pendingId],
    );
  }

  async setTargetApyBps(
    sender: AccountAddressInput,
    args: FlexibleSetTargetApyArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::FlexibleYieldPool::set_target_apy_bps`,
      [args.newTargetApyBps],
    );
  }

  async setPerformanceFeeBps(
    sender: AccountAddressInput,
    args: FlexibleSetPerformanceFeeArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::FlexibleYieldPool::set_performance_fee_bps`,
      [args.newPerformanceFeeBps],
    );
  }

  async setTreasury(
    sender: AccountAddressInput,
    args: FlexibleSetTreasuryArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::FlexibleYieldPool::set_treasury`,
      [args.newTreasury],
    );
  }

  async setDepositsEnabled(
    sender: AccountAddressInput,
    args: FlexibleSetDepositsEnabledArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::FlexibleYieldPool::set_deposits_enabled`,
      [args.enabled],
    );
  }

  async setMinDeposit(
    sender: AccountAddressInput,
    args: FlexibleSetMinDepositArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::FlexibleYieldPool::set_min_deposit`,
      [args.newMinDeposit],
    );
  }

  async setMaxTargetApyBps(
    sender: AccountAddressInput,
    args: FlexibleSetMaxTargetApyArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::FlexibleYieldPool::set_max_target_apy_bps`,
      [args.newMaxTargetApyBps],
    );
  }

  async setWithdrawalsEnabled(
    sender: AccountAddressInput,
    args: FlexibleSetWithdrawalsEnabledArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::FlexibleYieldPool::set_withdrawals_enabled`,
      [args.enabled],
    );
  }

  async proposeAdmin(
    sender: AccountAddressInput,
    args: FlexibleProposeAdminArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::FlexibleYieldPool::propose_admin`,
      [args.newAdmin],
    );
  }

  async acceptAdmin(sender: AccountAddressInput): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::FlexibleYieldPool::accept_admin`,
      [],
    );
  }

  depositPayload(args: FlexibleDepositArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::FlexibleYieldPool::deposit`,
      [args.amount, args.minPoolShares],
    );
  }

  requestWithdrawPayload(args: FlexibleRequestWithdrawArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::FlexibleYieldPool::request_withdraw`,
      [args.grossAmount, args.minLpPrice],
    );
  }

  completeWithdrawPayload(args: FlexibleCompleteWithdrawArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::FlexibleYieldPool::complete_withdraw`,
      [args.pendingId],
    );
  }

  setTargetApyBpsPayload(args: FlexibleSetTargetApyArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::FlexibleYieldPool::set_target_apy_bps`,
      [args.newTargetApyBps],
    );
  }

  setPerformanceFeeBpsPayload(args: FlexibleSetPerformanceFeeArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::FlexibleYieldPool::set_performance_fee_bps`,
      [args.newPerformanceFeeBps],
    );
  }

  setTreasuryPayload(args: FlexibleSetTreasuryArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::FlexibleYieldPool::set_treasury`,
      [args.newTreasury],
    );
  }

  setDepositsEnabledPayload(args: FlexibleSetDepositsEnabledArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::FlexibleYieldPool::set_deposits_enabled`,
      [args.enabled],
    );
  }

  setMinDepositPayload(args: FlexibleSetMinDepositArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::FlexibleYieldPool::set_min_deposit`,
      [args.newMinDeposit],
    );
  }

  setMaxTargetApyBpsPayload(
    args: FlexibleSetMaxTargetApyArgs,
  ): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::FlexibleYieldPool::set_max_target_apy_bps`,
      [args.newMaxTargetApyBps],
    );
  }

  setWithdrawalsEnabledPayload(
    args: FlexibleSetWithdrawalsEnabledArgs,
  ): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::FlexibleYieldPool::set_withdrawals_enabled`,
      [args.enabled],
    );
  }

  proposeAdminPayload(args: FlexibleProposeAdminArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::FlexibleYieldPool::propose_admin`,
      [args.newAdmin],
    );
  }

  acceptAdminPayload(): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::FlexibleYieldPool::accept_admin`,
      [],
    );
  }
}
