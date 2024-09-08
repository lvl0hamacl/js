import { useQuery } from "@tanstack/react-query";
import { nativeLocalStorage } from "../../../../utils/storage/nativeStorage.js";
import { getWalletInfo } from "../../../../wallets/__generated__/getWalletInfo.js";
import type { Wallet } from "../../../../wallets/interfaces/wallet.js";
import { getStoredActiveWalletId } from "../../../../wallets/manager/index.js";
import type { Theme } from "../../../core/design-system/index.js";
import { getLastAuthProvider } from "../../../core/utils/storage.js";
import { getWalletIcon } from "../../../core/utils/walletIcon.js";
import {
  APPLE_ICON,
  DISCORD_ICON,
  FACEBOOK_ICON,
  FARCASTER_ICON,
  GOOGLE_ICON,
  TELEGRAM_ICON,
  WALLET_ICON,
} from "../icons/svgs.js";
import { RNImage } from "./RNImage.js";

export const WalletImage = (props: {
  theme: Theme;
  wallet: Wallet;
  size: number;
  avatar?: string | null;
}) => {
  const { wallet, avatar, size } = props;

  const { data: imageData } = useQuery({
    queryKey: ["wallet-image", wallet.id, wallet.getAccount()?.address],
    queryFn: async (): Promise<string> => {
      let activeEOAId = wallet.id;
      if (wallet.id === "smart") {
        // TODO (rn) investigate why the first render this returns null from storage
        const storedId = await getStoredActiveWalletId(nativeLocalStorage);
        if (storedId) {
          activeEOAId = storedId;
        } else {
          throw new Error("No active EOA wallet");
        }
      }
      let imageData: string;
      if (
        activeEOAId === "inApp" &&
        (wallet.id === "inApp" || wallet.id === "smart")
      ) {
        const lastAuthProvider = await getLastAuthProvider(nativeLocalStorage);
        imageData = getAuthProviderImage(lastAuthProvider);
        return imageData;
      }
      try {
        const externalWalletImage = await getWalletInfo(activeEOAId, true);
        if (externalWalletImage) {
          return externalWalletImage;
        }
      } catch {}

      return WALLET_ICON;
    },
    enabled: !avatar,
  });

  const data = avatar || imageData || WALLET_ICON;
  return <RNImage theme={props.theme} data={data} size={size} />;
};

export function getAuthProviderImage(lastAuthProvider: string | null): string {
  switch (lastAuthProvider) {
    case "phone":
    case "email":
    case "passkey":
      return getWalletIcon(lastAuthProvider);
    case "google":
      return GOOGLE_ICON;
    case "apple":
      return APPLE_ICON;
    case "facebook":
      return FACEBOOK_ICON;
    case "discord":
      return DISCORD_ICON;
    case "farcaster":
      return FARCASTER_ICON;
    case "telegram":
      return TELEGRAM_ICON;
    default:
      return getWalletIcon("");
  }
}
