import type { Wallet } from "../../../../wallets/interfaces/wallet.js";
import type { WalletInfo } from "../../../../wallets/wallet-info.js";
import { useConnectUI } from "../../../core/hooks/others/useWalletConnectionCtx.js";

import type { InjectedWalletLocale } from "../injected/locale/types.js";

import { useCallback, useEffect, useRef, useState } from "react";
import type { COINBASE } from "../../../../wallets/constants.js";
import { ConnectingScreen } from "./ConnectingScreen.js";

/**
 * @internal
 */
function CoinbaseSDKWalletConnectUI(props: {
  onBack?: () => void;
  onGetStarted: () => void;
  done: () => void;
  locale: InjectedWalletLocale;
  wallet: Wallet<typeof COINBASE>;
  walletInfo: WalletInfo;
  connectError: boolean;
}) {
  const { onBack, done, wallet, walletInfo, onGetStarted, locale } = props;
  const [errorConnecting, setErrorConnecting] = useState(false);
  const { client, chain } = useConnectUI();

  // handle initial connection error that is passed down (optionally from the parent)
  // the ref keeps track of if we have internally to this component re-set the state, in which case we ignore the passed down error
  const hasInternalError = useRef(false);
  useEffect(() => {
    if (!props.connectError || hasInternalError.current) {
      return;
    }
    setErrorConnecting(true);
  }, [props.connectError]);

  const connect = useCallback(() => {
    setErrorConnecting(false);
    wallet
      .connect({
        client,
        chain,
      })
      .then(() => {
        done();
      })
      .catch(() => {
        hasInternalError.current = true;
        setErrorConnecting(true);
      });
  }, [client, wallet, chain, done]);

  return (
    <ConnectingScreen
      locale={{
        getStartedLink: locale.getStartedLink,
        instruction: locale.connectionScreen.instruction,
        tryAgain: locale.connectionScreen.retry,
        inProgress: locale.connectionScreen.inProgress,
        failed: locale.connectionScreen.failed,
      }}
      onBack={onBack}
      walletName={walletInfo.name}
      walletId={wallet.id}
      errorConnecting={errorConnecting}
      onRetry={connect}
      onGetStarted={onGetStarted}
    />
  );
}

export default CoinbaseSDKWalletConnectUI;
