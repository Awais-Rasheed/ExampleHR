import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum SyncType {
  REALTIME = 'REALTIME',
  BATCH = 'BATCH',
}

export enum SyncStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity('sync_logs')
export class SyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  type: SyncType;

  @Column({ type: 'varchar' })
  status: SyncStatus;

  @Column({ type: 'varchar', nullable: true })
  employeeId: string;

  @Column({ type: 'varchar', nullable: true })
  locationId: string;

  @Column({ type: 'integer', nullable: true })
  recordsAffected: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
