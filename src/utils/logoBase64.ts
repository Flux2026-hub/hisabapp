import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";

let cachedLogo: string | null = null;
let attempted = false;

export async function getLogoBase64(): Promise<string | null> {
  if (attempted) return cachedLogo;
  attempted = true;
  try {
    const asset = Asset.fromModule(
      require("../../assets/images/flux-logo.png")
    );
    if (!asset.localUri) {
      await asset.downloadAsync();
    }
    const uri = asset.localUri || asset.uri;
    if (!uri) return null;
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    cachedLogo = "data:image/png;base64," + base64;
    return cachedLogo;
  } catch (e) {
    console.log("Logo load failed", e);
    return null;
  }
}
