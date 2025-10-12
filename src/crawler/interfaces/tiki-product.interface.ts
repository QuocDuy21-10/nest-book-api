export interface TikiProduct {
  id: number;
  sku: string;
  name: string;
  price: number;
  list_price: number;
  original_price: number;
  thumbnail_url: string;
  quantity_sold: {
    value: number;
  };
}
