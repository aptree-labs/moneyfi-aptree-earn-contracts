import { AccountAddressInput } from "@aptos-labs/ts-sdk";
import { BaseModule } from "../base-module";
import type {
  FlexiblePoolConfig,
  UserFlexiblePendingWithdrawals,
  UserFlexibleTickets,
} from "../../types/flexible-yield";

export class FlexibleYieldResources extends BaseModule {
  async getConfig(address: AccountAddressInput): Promise<FlexiblePoolConfig> {
    return this.getResource<FlexiblePoolConfig>(
      address,
      `${this.addresses.aptree}::FlexibleYieldPool::FlexiblePoolConfig`,
    );
  }

  async getUserTickets(
    user: AccountAddressInput,
  ): Promise<UserFlexibleTickets> {
    return this.getResource<UserFlexibleTickets>(
      user,
      `${this.addresses.aptree}::FlexibleYieldPool::UserFlexibleTickets`,
    );
  }

  async getUserPendingWithdrawals(
    user: AccountAddressInput,
  ): Promise<UserFlexiblePendingWithdrawals> {
    return this.getResource<UserFlexiblePendingWithdrawals>(
      user,
      `${this.addresses.aptree}::FlexibleYieldPool::UserPendingWithdrawals`,
    );
  }
}
