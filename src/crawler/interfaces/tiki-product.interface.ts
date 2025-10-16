export interface TikiProductQuantitySold {
  value: number;
}

export interface TikiAuthorData {
  id: number;
  name: string;
  slug: string;
}

export interface TikiProductListItem {
  id: number;
  sku?: string;
  name: string;
  price?: number;
  list_price?: number;
  original_price?: number;
  promotional_price?: number;
  thumbnail_url?: string;
  quantity_sold?: TikiProductQuantitySold | null;
}

export interface TikiProductDetail extends TikiProductListItem {
  description?: string;
  short_description?: string;
  all_time_quantity_sold?: number;
  authors?: TikiAuthorData[];
}
