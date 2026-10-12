import { FLUX_LOGO_DATA_URI } from "./logoData";

export async function getLogoBase64(): Promise<string | null> {
  return FLUX_LOGO_DATA_URI;
}
