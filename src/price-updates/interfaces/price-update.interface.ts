export interface PriceUpdateMessage {
  bookId: string;
  externalId: string;
  source: string;
  jobId: string;
  newPrice: number;
  originalPrice: number;
  status: PriceUpdateStatus;
  errorMessage?: string;
  timestamp: string;
}

export enum PriceUpdateStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}
