import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

interface Balance {
  employeeId: string;
  locationId: string;
  availableDays: number;
}

@Injectable()
export class MockHcmService {
  private balances: Map<string, Balance> = new Map();

  constructor() {
    this.seedData();
  }

  private seedData() {
    const seedBalances: Balance[] = [
      { employeeId: 'EMP001', locationId: 'LOC001', availableDays: 15.0 },
      { employeeId: 'EMP001', locationId: 'LOC002', availableDays: 10.0 },
      { employeeId: 'EMP002', locationId: 'LOC001', availableDays: 20.0 },
      { employeeId: 'EMP003', locationId: 'LOC002', availableDays: 12.5 },
      { employeeId: 'EMP004', locationId: 'LOC003', availableDays: 18.0 },
      { employeeId: 'EMP005', locationId: 'LOC003', availableDays: 25.0 },
    ];

    seedBalances.forEach((balance) => {
      const key = this.getKey(balance.employeeId, balance.locationId);
      this.balances.set(key, balance);
    });
  }

  private getKey(employeeId: string, locationId: string): string {
    return `${employeeId}:${locationId}`;
  }

  getBalance(employeeId: string, locationId: string): Balance {
    const key = this.getKey(employeeId, locationId);
    const balance = this.balances.get(key);
    if (!balance) {
      throw new NotFoundException('Balance not found');
    }
    return balance;
  }

  deductBalance(employeeId: string, locationId: string, days: number): Balance {
    const key = this.getKey(employeeId, locationId);
    const balance = this.balances.get(key);

    if (!balance) {
      throw new NotFoundException('Balance not found');
    }

    if (balance.availableDays < days) {
      throw new UnprocessableEntityException('Insufficient balance');
    }

    balance.availableDays -= days;
    this.balances.set(key, balance);
    return balance;
  }

  restoreBalance(employeeId: string, locationId: string, days: number): Balance {
    const key = this.getKey(employeeId, locationId);
    const balance = this.balances.get(key);

    if (!balance) {
      throw new NotFoundException('Balance not found');
    }

    balance.availableDays += days;
    this.balances.set(key, balance);
    return balance;
  }

  getAllBalances(): Balance[] {
    return Array.from(this.balances.values());
  }

  addBonusDays(employeeId: string, locationId: string, bonusDays: number): Balance {
    const key = this.getKey(employeeId, locationId);
    const balance = this.balances.get(key);

    if (!balance) {
      throw new NotFoundException('Balance not found');
    }

    balance.availableDays += bonusDays;
    this.balances.set(key, balance);
    return balance;
  }

  reset(): void {
    this.balances.clear();
    this.seedData();
  }
}
