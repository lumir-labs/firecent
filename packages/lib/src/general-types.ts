export type Color =
  | "DEFAULT"
  | "GRAY"
  | "BROWN"
  | "ORANGE"
  | "YELLOW"
  | "GREEN"
  | "BLUE"
  | "PURPLE"
  | "PINK"
  | "RED";

export type GenericCatalogItem = {
  id: number | string;
  label: string;
  color?: Color;
  colorClassName?: string;
  colorCSS?: string;
  description?: string;
  badge?: string | null;
  imageSrc?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  iconElement?: any;
};

export type UseCatalogFnResult = {
  data: GenericCatalogItem[];
  isLoading: boolean;
  isFetching?: boolean;
  error: Error | null;
};

export type colorType =
  | "default"
  | "pink"
  | "gray"
  | "brown"
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "purple"
  | "blue";
