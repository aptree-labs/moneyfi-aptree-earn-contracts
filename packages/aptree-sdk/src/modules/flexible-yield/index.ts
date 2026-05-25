import { AccountAddressInput, Aptos } from "@aptos-labs/ts-sdk";
import { AptreeAddresses } from "../../config";
import { BaseModule } from "../base-module";
import { FlexibleYieldBuilder } from "./builder";
import { FlexibleYieldResources } from "./resources";
import type {
  FlexiblePendingWithdrawal,
  FlexibleProtocolStats,
  FlexibleTicket,
  FlexibleWithdrawalPreview,
} from "../../types/flexible-yield";

export class FlexibleYieldModule extends BaseModule {
  readonly builder: FlexibleYieldBuilder;
  readonly resources: FlexibleYieldResources;

  constructor(aptos: Aptos, addresses: AptreeAddresses) {
    super(aptos, addresses);
    this.builder = new FlexibleYieldBuilder(aptos, addresses);
    this.resources = new FlexibleYieldResources(aptos, addresses);
  }

  async getUserTickets(user: AccountAddressInput): Promise<FlexibleTicket[]> {
    const [result] = await this.view<[FlexibleTicket[]]>(
      `${this.addresses.aptree}::FlexibleYieldPool::get_user_tickets`,
      [user],
    );
    return result;
  }

  async getPendingWithdrawals(
    user: AccountAddressInput,
  ): Promise<FlexiblePendingWithdrawal[]> {
    const [result] = await this.view<[FlexiblePendingWithdrawal[]]>(
      `${this.addresses.aptree}::FlexibleYieldPool::get_pending_withdrawals`,
      [user],
    );
    return result;
  }

  async getPoolNav(): Promise<number> {
    const [result] = await this.view<[string]>(
      `${this.addresses.aptree}::FlexibleYieldPool::get_pool_nav`,
    );
    return Number(result);
  }

  async getPoolValue(): Promise<number> {
    const [result] = await this.view<[string]>(
      `${this.addresses.aptree}::FlexibleYieldPool::get_pool_value`,
    );
    return Number(result);
  }

  async getProtocolStats(): Promise<FlexibleProtocolStats> {
    const [
      totalInternalShares,
      totalAetHeld,
      totalPrincipal,
      totalPendingGross,
      totalFeesCollected,
      targetApyBps,
      performanceFeeBps,
    ] = await this.view<[string, string, string, string, string, string, string]>(
      `${this.addresses.aptree}::FlexibleYieldPool::get_protocol_stats`,
    );

    return {
      totalInternalShares: Number(totalInternalShares),
      totalAetHeld: Number(totalAetHeld),
      totalPrincipal: Number(totalPrincipal),
      totalPendingGross: Number(totalPendingGross),
      totalFeesCollected: Number(totalFeesCollected),
      targetApyBps: Number(targetApyBps),
      performanceFeeBps: Number(performanceFeeBps),
    };
  }

  async previewWithdrawal(
    user: AccountAddressInput,
    grossAmount: number,
  ): Promise<FlexibleWithdrawalPreview> {
    const [
      previewGrossAmount,
      principalPortion,
      actualProfit,
      targetProfit,
      excessProfit,
      fee,
      userReceives,
      sharesBurned,
    ] = await this.view<[string, string, string, string, string, string, string, string]>(
      `${this.addresses.aptree}::FlexibleYieldPool::preview_withdrawal`,
      [user, grossAmount],
    );

    return {
      grossAmount: Number(previewGrossAmount),
      principalPortion: Number(principalPortion),
      actualProfit: Number(actualProfit),
      targetProfit: Number(targetProfit),
      excessProfit: Number(excessProfit),
      fee: Number(fee),
      userReceives: Number(userReceives),
      sharesBurned: Number(sharesBurned),
    };
  }

  async getTreasury(): Promise<string> {
    const [result] = await this.view<[string]>(
      `${this.addresses.aptree}::FlexibleYieldPool::get_treasury`,
    );
    return result;
  }

  async areDepositsEnabled(): Promise<boolean> {
    const [result] = await this.view<[boolean]>(
      `${this.addresses.aptree}::FlexibleYieldPool::are_deposits_enabled`,
    );
    return result;
  }

  async getMinDeposit(): Promise<number> {
    const [result] = await this.view<[string]>(
      `${this.addresses.aptree}::FlexibleYieldPool::get_min_deposit`,
    );
    return Number(result);
  }

  async areWithdrawalsEnabled(): Promise<boolean> {
    const [result] = await this.view<[boolean]>(
      `${this.addresses.aptree}::FlexibleYieldPool::are_withdrawals_enabled`,
    );
    return result;
  }

  async getMaxTargetApyBps(): Promise<number> {
    const [result] = await this.view<[string]>(
      `${this.addresses.aptree}::FlexibleYieldPool::get_max_target_apy_bps`,
    );
    return Number(result);
  }

  async getAdmin(): Promise<string> {
    const [result] = await this.view<[string]>(
      `${this.addresses.aptree}::FlexibleYieldPool::get_admin`,
    );
    return result;
  }

  /** Returns `null` when no admin transfer is in flight. */
  async getPendingAdmin(): Promise<string | null> {
    const [result] = await this.view<[{ vec: [] | [string] }]>(
      `${this.addresses.aptree}::FlexibleYieldPool::get_pending_admin`,
    );
    return result.vec.length === 0 ? null : result.vec[0];
  }
}

export { FlexibleYieldBuilder } from "./builder";
export { FlexibleYieldResources } from "./resources";
