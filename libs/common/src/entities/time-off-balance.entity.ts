import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';

@Entity('time_off_balances')
@Unique(['employeeId', 'locationId'])
export class TimeOffBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: false })
  employeeId: string;

  @Column({ type: 'varchar', nullable: false })
  locationId: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: false })
  availableDays: number;

  @Column({ type: 'datetime', nullable: false })
  lastSyncedAt: Date;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
