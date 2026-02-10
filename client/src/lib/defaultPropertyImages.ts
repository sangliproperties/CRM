// Default images for property categories
import residentialImg from "@assets/stock_images/modern_luxury_reside_3d94a884.jpg";
import commercialImg from "@assets/stock_images/modern_commercial_of_182ae03a.jpg";
import industrialImg from "@assets/stock_images/industrial_factory_b_61650850.jpg";
import agriculturalImg from "@assets/stock_images/agricultural_farmlan_a281e884.jpg";
import landPlotImg from "@assets/stock_images/empty_land_plot_real_9c93e8fe.jpg";
import officeSpaceImg from "@assets/stock_images/modern_corporate_off_545b6685.jpg";
import retailImg from "@assets/stock_images/retail_store_shoppin_2451bb21.jpg";
import warehouseImg from "@assets/stock_images/warehouse_storage_fa_4c868213.jpg";

export const defaultPropertyImages: Record<string, string> = {
  "Residential": residentialImg,
  "Commercial": commercialImg,
  "Industrial": industrialImg,
  "Agricultural": agriculturalImg,
  "Land/Plot": landPlotImg,
  "Office Space": officeSpaceImg,
  "Retail": retailImg,
  "Warehouse": warehouseImg,
};

export function getDefaultPropertyImage(propertyType?: string | null): string {
  if (!propertyType) {
    return residentialImg; // Default to residential if no type specified
  }
  return defaultPropertyImages[propertyType] || residentialImg;
}
