import {
  contractKeys,
  networkKeys,
  useDashboardEVMChainId,
} from "@3rdweb-sdk/react";
import { useMutationWithInvalidate } from "@3rdweb-sdk/react/hooks/query/useQueryWithNetwork";
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useSDK, useSigner } from "@thirdweb-dev/react";
import {
  type DeploymentTransaction,
  type ExtraPublishMetadata,
  type FeatureName,
  type FeatureWithEnabled,
  type PublishedContract,
  type ThirdwebSDK,
  detectFeatures,
  fetchAndCacheDeployMetadata,
  fetchContractMetadata,
  fetchPreDeployMetadata,
  fetchRawPredeployMetadata,
  getTrustedForwarders,
  isExtensionEnabled,
} from "@thirdweb-dev/sdk";
import {
  getZkTransactionsForDeploy,
  zkDeployContractFromUri,
} from "@thirdweb-dev/sdk/evm/zksync";
import type { Abi } from "abitype";
import type { ProfileMetadata, ProfileMetadataInput } from "constants/schemas";
import type { providers } from "ethers";
import { useSupportedChain } from "hooks/chains/configureChains";
import { isEnsName, resolveEns } from "lib/ens";
import { getDashboardChainRpc } from "lib/rpc";
import { StorageSingleton, getThirdwebSDK } from "lib/sdk";
import { useRouter } from "next/router";
import { useMemo } from "react";
import { getContract } from "thirdweb";
import {
  abstractTestnet,
  polygon,
  zkCandySepolia,
  zkSync,
  zkSyncSepolia,
} from "thirdweb/chains";
import { resolveContractAbi } from "thirdweb/contract";
import {
  useActiveAccount,
  useActiveWallet,
  useActiveWalletChain,
} from "thirdweb/react";
import { isAddress } from "thirdweb/utils";
import invariant from "tiny-invariant";
import { Web3Provider } from "zksync-ethers";
import { thirdwebClient } from "../../@/constants/client";
import { useV5DashboardChain } from "../../lib/v5-adapter";
import type { CustomContractDeploymentFormData } from "./contract-deploy-form/custom-contract";
import type {
  DeployModalStep,
  DeployStatusModal,
} from "./contract-deploy-form/deploy-context-modal";
import { uploadContractMetadata } from "./contract-deploy-form/deploy-form-utils";
import type { ContractId } from "./types";
import { addContractToMultiChainRegistry } from "./utils";

function isChainIdZkSync(chainId?: number) {
  switch (chainId) {
    case zkSync.id:
    case zkSyncSepolia.id:
    case zkCandySepolia.id:
    case abstractTestnet.id:
      // TODO - add more ZK chains here
      return true;
    default:
      return false;
  }
}

// metadata PRE publish, only has the compiler output info (from CLI)
export async function fetchRawPredeployMetadataFromURI(contractId: ContractId) {
  const contractIdIpfsHash = toContractIdIpfsHash(contractId);

  invariant(contractId !== "ipfs://undefined", "uri can't be undefined");
  let resolved:
    | Awaited<ReturnType<typeof fetchRawPredeployMetadata>>
    | undefined = undefined;
  try {
    resolved = await fetchRawPredeployMetadata(
      contractIdIpfsHash,
      StorageSingleton,
    );
  } catch (err) {
    console.error("failed to resolvePreDeployMetadata", err);
  }

  if (!resolved) {
    return {
      name: "",
      metadataUri: "",
      bytecodeUri: "",
    };
  }

  return {
    name: resolved.name,
    metadataUri: resolved.metadataUri,
    bytecodeUri: resolved.bytecodeUri,
    analytics: removeUndefinedFromObject(resolved.analytics),
    compilers: resolved.compilers,
  };
}

export function useContractRawPredeployMetadataFromURI(contractId: ContractId) {
  return useQuery({
    queryKey: ["raw-predeploy-metadata", contractId],
    queryFn: () => fetchRawPredeployMetadataFromURI(contractId),

    enabled: !!contractId,
  });
}

// biome-ignore lint/suspicious/noExplicitAny: FIXME
function removeUndefinedFromObject(obj: Record<string, any>) {
  // biome-ignore lint/suspicious/noExplicitAny: FIXME
  const newObj: Record<string, any> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      newObj[key] = obj[key];
    }
  }
  return newObj;
}

// metadata PRE publish, only has the compiler output info (from CLI)
export async function fetchContractPublishMetadataFromURI(
  contractId: ContractId,
) {
  const contractIdIpfsHash = toContractIdIpfsHash(contractId);

  invariant(contractId !== "ipfs://undefined", "uri can't be undefined");
  let resolved: Awaited<ReturnType<typeof fetchPreDeployMetadata>> | undefined =
    undefined;
  try {
    resolved = await fetchPreDeployMetadata(
      contractIdIpfsHash,
      StorageSingleton,
    );
  } catch (err) {
    console.error("failed to resolvePreDeployMetadata", err);
  }

  if (!resolved) {
    return {
      name: "",
      image: "custom",
    };
  }

  return {
    // biome-ignore lint/suspicious/noExplicitAny: FIXME
    image: (resolved as any)?.image || "custom",
    name: resolved.name,
    description: resolved.info?.title || "",
    abi: resolved.abi,
    info: removeUndefinedFromObject(resolved.info),
    licenses: resolved.licenses,
    compilerMetadata: resolved.metadata,
    analytics: removeUndefinedFromObject(resolved.analytics),
  };
}

export function useContractPublishMetadataFromURI(contractId: ContractId) {
  return useQuery({
    queryKey: ["publish-metadata", contractId],
    queryFn: () => fetchContractPublishMetadataFromURI(contractId),
    enabled: !!contractId,
  });
}

export function useDefaultForwarders() {
  const sdk = useSDK();
  const provider = sdk?.getProvider();
  invariant(provider, "Require provider");

  const chainId = useDashboardEVMChainId();

  return useQuery({
    queryKey: ["default-forwarders", chainId],
    queryFn: () => {
      return getTrustedForwarders(provider, StorageSingleton);
    },
  });
}

// metadata PRE publish, only contains the compiler output
// if passing an address, also fetches the latest version of the matching contract
export function useContractPrePublishMetadata(uri: string, address?: string) {
  const contractIdIpfsHash = toContractIdIpfsHash(uri);

  return useQuery({
    queryKey: ["pre-publish-metadata", uri, address],
    queryFn: async () => {
      invariant(address, "address is not defined");
      // TODO: Make this nicer.
      invariant(uri !== "ipfs://undefined", "uri can't be undefined");
      const sdk = getThirdwebSDK(
        polygon.id,
        getDashboardChainRpc(polygon.id, undefined),
      );
      return await sdk
        ?.getPublisher()
        .fetchPrePublishMetadata(contractIdIpfsHash, address);
    },

    enabled: !!uri && !!address,
  });
}

async function fetchFullPublishMetadata(
  sdk: ThirdwebSDK,
  uri: string,
  queryClient: QueryClient,
) {
  const rawPublishMetadata = await sdk
    .getPublisher()
    .fetchFullPublishMetadata(uri);

  const ensResult = rawPublishMetadata.publisher
    ? await queryClient.fetchQuery(ensQuery(rawPublishMetadata.publisher))
    : undefined;

  return {
    ...rawPublishMetadata,
    publisher:
      ensResult?.ensName || ensResult?.address || rawPublishMetadata.publisher,
  };
}

// Metadata POST publish, contains all the extra information filled in by the user
export function useContractFullPublishMetadata(uri: string) {
  const contractIdIpfsHash = toContractIdIpfsHash(uri);
  const sdk = getThirdwebSDK(
    polygon.id,
    getDashboardChainRpc(polygon.id, undefined),
  );
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["full-publish-metadata", uri],
    queryFn: async () => {
      invariant(sdk, "sdk is not defined");
      // TODO: Make this nicer.
      invariant(uri !== "ipfs://undefined", "uri can't be undefined");
      return await fetchFullPublishMetadata(
        sdk,
        contractIdIpfsHash,
        queryClient,
      );
    },

    enabled: !!uri && !!sdk,
  });
}

async function fetchPublisherProfile(publisherAddress?: string | null) {
  const sdk = getThirdwebSDK(
    polygon.id,
    getDashboardChainRpc(polygon.id, undefined),
  );
  invariant(publisherAddress, "address is not defined");
  return (await sdk
    .getPublisher()
    // todo: remove type-casting once we have replaced this method
    .getPublisherProfile(publisherAddress)) as ProfileMetadata;
}

export function publisherProfileQuery(publisherAddress?: string) {
  return {
    queryKey: ["releaser-profile", publisherAddress],
    queryFn: () => fetchPublisherProfile(publisherAddress),
    enabled: !!publisherAddress,
    // 24h
    cacheTime: 60 * 60 * 24 * 1000,
    // 1h
    staleTime: 60 * 60 * 1000,
    // default to the one we know already
  };
}

export function usePublisherProfile(publisherAddress?: string) {
  return useQuery(publisherProfileQuery(publisherAddress));
}

export async function fetchAllVersions(
  sdk?: ThirdwebSDK,
  publisherAddress?: string,
  contractName?: string,
) {
  invariant(publisherAddress, "address is not defined");
  invariant(contractName, "contract name is not defined");
  invariant(sdk, "sdk not provided");

  const allVersions = await sdk
    .getPublisher()
    .getAllVersions(publisherAddress, contractName);

  const publishedVersions = [];

  for (let i = 0; i < allVersions.length; i++) {
    const contractInfo = await sdk
      .getPublisher()
      .fetchPublishedContractInfo(allVersions[i])
      .catch(() => {
        console.error(
          `failed to fetchPublishedContractInfo for metadataUri: ${allVersions[i].metadataUri} - ignoring version`,
        );
        return null;
      });
    if (!contractInfo) {
      continue;
    }

    publishedVersions.unshift({
      ...allVersions[i],
      version: contractInfo.publishedMetadata.version,
      name: contractInfo.publishedMetadata.name,
      displayName: contractInfo.publishedMetadata.displayName || "",
      description: contractInfo.publishedMetadata.description || "",
      publisher: contractInfo.publishedMetadata.publisher || "",
      audit: contractInfo.publishedMetadata.audit || "",
      logo: contractInfo.publishedMetadata.logo || "",
    });
  }

  return publishedVersions;
}

export function useAllVersions(
  publisherAddress?: string,
  contractName?: string,
) {
  const sdk = getThirdwebSDK(
    polygon.id,
    getDashboardChainRpc(polygon.id, undefined),
  );
  return useQuery({
    queryKey: ["all-releases", publisherAddress, contractName],
    queryFn: () => fetchAllVersions(sdk, publisherAddress, contractName),

    enabled: !!publisherAddress && !!contractName && !!sdk,
  });
}

export function usePublishedContractsFromDeploy(
  contractAddress?: string,
  chainId?: number,
) {
  const activeChainId = useDashboardEVMChainId();
  const cId = chainId || activeChainId;
  const chainInfo = useSupportedChain(cId || -1);

  return useQuery({
    queryKey: (networkKeys.chain(cId) as readonly unknown[]).concat([
      "release-from-deploy",
      contractAddress,
    ]),
    queryFn: async () => {
      invariant(contractAddress, "contractAddress is not defined");
      invariant(cId, "chain not defined");

      const rpcUrl = chainInfo
        ? getDashboardChainRpc(cId, chainInfo)
        : undefined;

      invariant(rpcUrl, "rpcUrl not defined");
      const sdk = getThirdwebSDK(cId, rpcUrl);

      const contractUri = await sdk
        .getPublisher()
        .resolveContractUriFromAddress(contractAddress);

      const polygonSdk = getThirdwebSDK(
        polygon.id,
        getDashboardChainRpc(polygon.id, undefined),
      );

      return await polygonSdk
        .getPublisher()
        .resolvePublishMetadataFromCompilerMetadata(contractUri);
    },

    enabled: !!contractAddress && !!cId && !!chainInfo,
    retry: false,
  });
}

export async function fetchPublishedContractInfo(
  sdk?: ThirdwebSDK,
  contract?: PublishedContract,
) {
  invariant(contract, "contract is not defined");
  invariant(sdk, "sdk not provided");
  return await sdk.getPublisher().fetchPublishedContractInfo(contract);
}

export function usePublishedContractInfo(contract: PublishedContract) {
  const sdk = getThirdwebSDK(
    polygon.id,
    getDashboardChainRpc(polygon.id, undefined),
  );
  return useQuery({
    queryKey: ["released-contract", contract],
    queryFn: () => fetchPublishedContractInfo(sdk, contract),

    enabled: !!contract,
  });
}
export function usePublishedContractFunctions(contract: PublishedContract) {
  const publishedContractInfo = usePublishedContractInfo(contract);
  const compositeAbi =
    publishedContractInfo.data?.publishedMetadata.compositeAbi;

  const { data: meta } = useContractPublishMetadataFromURI(
    contract.metadataUri,
  );

  const dynamicContractType =
    publishedContractInfo.data?.publishedMetadata.routerType;
  if (
    compositeAbi &&
    (dynamicContractType === "plugin" ||
      dynamicContractType === "dynamic" ||
      !publishedContractInfo.data?.publishedMetadata.deployType ||
      publishedContractInfo.data?.publishedMetadata.name.includes(
        "MarketplaceV3",
      ))
  ) {
    return compositeAbi.filter((f) => f.type === "function");
  }

  return meta?.abi?.filter((f) => f.type === "function") || [];
}
export function usePublishedContractEvents(contract: PublishedContract) {
  const publishedContractInfo = usePublishedContractInfo(contract);
  const compositeAbi =
    publishedContractInfo.data?.publishedMetadata.compositeAbi;

  const { data: meta } = useContractPublishMetadataFromURI(
    contract.metadataUri,
  );

  const dynamicContractType =
    publishedContractInfo.data?.publishedMetadata.routerType;
  if (
    compositeAbi &&
    (dynamicContractType === "plugin" ||
      dynamicContractType === "dynamic" ||
      !publishedContractInfo.data?.publishedMetadata.deployType ||
      publishedContractInfo.data?.publishedMetadata.name.includes(
        "MarketplaceV3",
      ))
  ) {
    return compositeAbi.filter((f) => f.type === "event");
  }

  return meta?.abi?.filter((f) => f.type === "event") || [];
}

export function usePublishedContractCompilerMetadata(
  contract: PublishedContract,
) {
  return useContractPublishMetadataFromURI(contract.metadataUri);
}

export function useFunctionParamsFromABI(abi?: Abi, functionName?: string) {
  return useMemo(() => {
    return abi && functionName
      ? abi
          .filter((a) => a.type === "function")
          .find((a) => a.name === functionName)?.inputs || []
      : [];
  }, [abi, functionName]);
}

function toContractIdIpfsHash(contractId: ContractId) {
  if (contractId?.startsWith("ipfs://")) {
    return contractId;
  }
  return `ipfs://${contractId}`;
}

interface PublishMutationData {
  predeployUri: string;
  extraMetadata: ExtraPublishMetadata;
  contractName?: string;
}

export function usePublishMutation() {
  // this has to actually have the signer!
  const sdk = useSDK();

  const address = useActiveAccount()?.address;

  return useMutationWithInvalidate(
    async ({ predeployUri, extraMetadata }: PublishMutationData) => {
      invariant(
        sdk && "getPublisher" in sdk,
        "sdk is not ready or does not support publishing",
      );
      const contractIdIpfsHash = toContractIdIpfsHash(predeployUri);
      await sdk.getPublisher().publish(contractIdIpfsHash, extraMetadata);
    },
    {
      onSuccess: (_data, variables, _options, invalidate) => {
        return Promise.all([
          invalidate([["pre-publish-metadata", variables.predeployUri]]),
          fetch(
            `/api/revalidate/publish?address=${address}&contractName=${variables.contractName}`,
          ).catch((err) => console.error("failed to revalidate", err)),
        ]);
      },
    },
  );
}

export function useEditProfileMutation() {
  const sdk = useSDK();
  const address = useActiveAccount()?.address;

  return useMutationWithInvalidate(
    async (data: ProfileMetadataInput) => {
      invariant(sdk, "sdk not provided");
      await sdk.getPublisher().updatePublisherProfile(data);
    },
    {
      onSuccess: (_data, _variables, _options, invalidate) => {
        return Promise.all([
          invalidate([["releaser-profile", address]]),
          fetch(`/api/revalidate/publish?address=${address}`).catch((err) =>
            console.error("failed to revalidate", err),
          ),
        ]);
      },
    },
  );
}

type ContractDeployMutationParams = CustomContractDeploymentFormData & {
  address: string | undefined;
  addToDashboard: boolean;
};

export function useCustomContractDeployMutation(options: {
  ipfsHash: string;
  version?: string;
  forceDirectDeploy?: boolean;
  hasContractURI?: boolean;
  hasRoyalty?: boolean;
  isSplit?: boolean;
  isVote?: boolean;
  isErc721SharedMetadadata?: boolean;
  deployStatusModal: DeployStatusModal;
}) {
  const {
    ipfsHash,
    version,
    hasContractURI,
    hasRoyalty,
    isSplit,
    isVote,
    isErc721SharedMetadadata,
    deployStatusModal,
    forceDirectDeploy,
  } = options;
  const sdk = useSDK();
  const queryClient = useQueryClient();
  const account = useActiveAccount();
  const walletAddress = account?.address;
  const chainId = useActiveWalletChain()?.id;
  const signer = useSigner();
  const { data: transactions } = useTransactionsForDeploy(ipfsHash);
  const fullPublishMetadata = useContractFullPublishMetadata(ipfsHash);
  const rawPredeployMetadata = useContractRawPredeployMetadataFromURI(ipfsHash);
  const router = useRouter();

  const walletId = useActiveWallet()?.id;

  return useMutation(
    async (_data: ContractDeployMutationParams) => {
      const data = { ..._data };

      invariant(
        sdk && "getPublisher" in sdk,
        "sdk is not ready or does not support publishing",
      );
      invariant(signer, "signer is not provided");
      invariant(walletAddress, "walletAddress is not provided");

      const requiresSignature = walletId !== "inApp";

      const stepDeploy: DeployModalStep = {
        signatureCount: requiresSignature ? transactions?.length || 1 : 0,
        type: "deploy",
      };

      const steps = [stepDeploy];

      if (isErc721SharedMetadadata) {
        steps.push({
          type: "setNFTMetadata",
          signatureCount: requiresSignature ? 1 : 0,
        });
      }

      if (data.addToDashboard) {
        steps.push({
          type: "import",
          signatureCount: requiresSignature ? 1 : 0,
        });
      }

      // open the modal with the appropriate steps
      deployStatusModal.open(steps);

      const isZkSync = isChainIdZkSync(chainId);

      let contractAddress: string;
      try {
        if (hasContractURI) {
          data.deployParams._contractURI = await uploadContractMetadata({
            ...data.contractMetadata,
            ...(hasRoyalty && {
              seller_fee_basis_points:
                typeof data.deployParams._royaltyBps === "string"
                  ? Number.parseInt(data.deployParams._royaltyBps, 10)
                  : data.deployParams?._royaltyBps || 0,
            }),
            ...(hasRoyalty && {
              fee_recipient: data.deployParams._royaltyRecipient,
            }),
            ...(isSplit && {
              recipients: data.recipients,
            }),
            ...(isVote && {
              voting_delay_in_blocks: Number(
                data.deployParams._initialVotingDelay,
              ),
              voting_period_in_blocks: Number(
                data.deployParams._initialVotingPeriod,
              ),
              voting_token_address: data.deployParams._token,
              voting_quorum_fraction: Number(
                data.deployParams._initialVoteQuorumFraction,
              ),
              proposal_token_threshold:
                data.deployParams._initialProposalThreshold,
            }),
          });
          if ("_name" in data.deployParams) {
            data.deployParams._name = data.contractMetadata?.name || "";
          }
          if ("_symbol" in data.deployParams) {
            data.deployParams._symbol = data.contractMetadata?.symbol || "";
          }
        }

        if (isSplit) {
          data.deployParams._payees = JSON.stringify(
            data.recipients?.map((r) => r.address) || [],
          );
          data.deployParams._shares = JSON.stringify(
            data.recipients?.map((r) => r.sharesBps) || [],
          );
        }

        if (data.deployParams?._defaultAdmin === "") {
          data.deployParams._defaultAdmin = data.address || "";
        }

        // Handle ZkSync deployments separately

        // deploy contract
        if (isZkSync) {
          // Get metamask signer using zksync-ethers library -- for custom fields in signature
          let deploySigner = signer;

          if (fullPublishMetadata?.data?.deployType === "standard") {
            // if its a direct deploy AND its zksync, use the ethers zksync signer for now
            // NOTE: this only works with injected wallets
            // TODO - implement deploying to zksync in v5 account and remove this
            const fakeExternalProvider: providers.ExternalProvider = {
              // fake tell it its metamask always (lul)
              isMetaMask: true,
              request({ method, params }) {
                switch (method) {
                  case "eth_accounts": {
                    return Promise.resolve([walletAddress]);
                  }
                  case "eth_signTypedData_v4": {
                    invariant(params?.[1], "invalid signTypedData call");
                    // yo dawg, I heard you like signing typed data
                    const { domain, types, message, primaryType } = JSON.parse(
                      params[1],
                    );
                    return (signer as providers.JsonRpcSigner)._signTypedData(
                      domain,
                      // don't ask...
                      { [primaryType]: types[primaryType] },
                      message,
                    );
                  }
                  case "eth_sendTransaction": {
                    const tx = params?.[0];
                    if (!tx) {
                      throw new Error("No transaction provided");
                    }
                    return signer.sendTransaction(tx);
                  }
                  case "personal_sign": {
                    const data = params?.[0];
                    if (!data) {
                      throw new Error("Nothing to sign");
                    }
                    return signer.signMessage(data);
                  }
                  default: {
                    return (signer as providers.JsonRpcSigner)?.provider?.send(
                      method,
                      params ?? [],
                    );
                  }
                }
              },
            };
            const zkSigner = new Web3Provider(fakeExternalProvider).getSigner();
            deploySigner = zkSigner;
          }

          const publishUri = ipfsHash.startsWith("ipfs://")
            ? ipfsHash
            : `ipfs://${ipfsHash}`;

          let uriToRegister = "";

          if (
            fullPublishMetadata?.data?.compilers?.zksolc ||
            rawPredeployMetadata?.data?.compilers?.zksolc
          ) {
            if (data.deployDeterministic) {
              const salt = data.signerAsSalt
                ? (await signer?.getAddress())?.concat(
                    data.saltForCreate2 || "",
                  )
                : data.saltForCreate2;

              contractAddress = await zkDeployContractFromUri(
                publishUri,
                Object.values(data.deployParams),
                deploySigner,
                StorageSingleton,
                chainId as number,
                {
                  compilerOptions: {
                    compilerType: "zksolc",
                  },
                  saltForProxyDeploy: salt,
                },
                true,
              );
            } else {
              contractAddress = await zkDeployContractFromUri(
                publishUri,
                Object.values(data.deployParams),
                deploySigner,
                StorageSingleton,
                chainId as number,
                {
                  compilerOptions: {
                    compilerType: "zksolc",
                  },
                },
              );
            }

            const { compilerMetadata } = await fetchAndCacheDeployMetadata(
              publishUri,
              StorageSingleton,
              {
                compilerType: "zksolc",
              },
            );
            uriToRegister = compilerMetadata.fetchedMetadataUri;
          } else {
            contractAddress = await zkDeployContractFromUri(
              publishUri,
              Object.values(data.deployParams),
              signer,
              StorageSingleton,
              chainId as number,
            );

            const { compilerMetadata } = await fetchAndCacheDeployMetadata(
              publishUri,
              StorageSingleton,
            );
            uriToRegister = compilerMetadata.fetchedMetadataUri;
          }

          // register deployed zksync contract on multichain registry
          await addContractToMultiChainRegistry(
            {
              address: contractAddress,
              chainId: chainId as number,
              metadataURI: uriToRegister,
            },
            account,
            300000n,
          );
        } else {
          if (data.deployDeterministic) {
            const salt = data.signerAsSalt
              ? (await signer?.getAddress())?.concat(data.saltForCreate2 || "")
              : data.saltForCreate2;
            contractAddress =
              await sdk.deployer.deployPublishedContractDeterministic(
                fullPublishMetadata.data?.name as string,
                Object.values(data.deployParams),
                fullPublishMetadata.data?.publisher as string,
                // this is either the contract version or it falls back to "latest"
                version,
                salt,
              );
          } else {
            contractAddress = await sdk.deployer.deployContractFromUri(
              ipfsHash.startsWith("ipfs://") ? ipfsHash : `ipfs://${ipfsHash}`,
              Object.values(data.deployParams),
              {
                forceDirectDeploy,
              },
            );
          }
        }

        deployStatusModal.nextStep();
      } catch (e) {
        // failed to deploy contract - close modal for now
        deployStatusModal.close();
        // re-throw error
        throw e;
      }

      const contract = await sdk.getContract(contractAddress);

      if (isErc721SharedMetadadata) {
        try {
          await contract.erc721.sharedMetadata.set({
            name: data.contractMetadata?.name || "",
            description: data.contractMetadata?.description || "",
            image: data.contractMetadata?.image || "",
          });

          deployStatusModal.nextStep();
        } catch {
          // failed to set metadata - for now just close the modal
          deployStatusModal.close();
          // not re-throwing the error, this is not technically a failure to deploy, just to set metadata - the contract is deployed already at this stage
        }
      }

      try {
        // let user decide if they want this or not
        if (data.addToDashboard && !isZkSync) {
          invariant(chainId, "chainId is not provided");
          await addContractToMultiChainRegistry(
            {
              address: contractAddress,
              chainId,
            },
            account,
            300000n,
          );

          deployStatusModal.nextStep();
        }
      } catch {
        // failed to add to dashboard - for now just close the modal
        deployStatusModal.close();
        router.replace(`/${chainId}/${contractAddress}`);

        // not re-throwing the error, this is not technically a failure to deploy, just to add to dashboard - the contract is deployed already at this stage
      }

      return contractAddress;
    },
    {
      onSuccess: async () => {
        return await queryClient.invalidateQueries([
          ...networkKeys.chain(chainId),
          ...contractKeys.list(walletAddress),
          [networkKeys.multiChainRegistry, walletAddress],
        ]);
      },
    },
  );
}

export function useTransactionsForDeploy(publishMetadataOrUri: string) {
  const sdk = useSDK();
  const chainId = useActiveWalletChain()?.id;

  const queryResult = useQuery<DeploymentTransaction[]>({
    queryKey: ["transactions-for-deploy", publishMetadataOrUri, chainId],
    queryFn: async () => {
      invariant(sdk, "sdk not provided");

      // Handle separately for ZkSync
      if (isChainIdZkSync(chainId)) {
        return await getZkTransactionsForDeploy();
      }

      return await sdk.deployer.getTransactionsForDeploy(
        publishMetadataOrUri.startsWith("ipfs://")
          ? publishMetadataOrUri
          : `ipfs://${publishMetadataOrUri}`,
      );
    },

    enabled: !!publishMetadataOrUri && !!sdk,
  });

  return queryResult;
}

export async function fetchPublishedContracts(
  sdk: ThirdwebSDK,
  queryClient: QueryClient,
  address?: string | null,
) {
  invariant(sdk, "sdk not provided");
  invariant(address, "address is not defined");
  const tempResult = ((await sdk.getPublisher().getAll(address)) || []).filter(
    (c) => c.id,
  );
  return await Promise.all(
    tempResult.map(async (c) => ({
      ...c,
      metadata: await fetchFullPublishMetadata(sdk, c.metadataUri, queryClient),
    })),
  );
}

export async function fetchPublishedContractsWithFeature(
  sdk: ThirdwebSDK,
  queryClient: QueryClient,
  feature: FeatureName,
  address?: string | null,
) {
  invariant(sdk, "sdk not provided");
  invariant(address, "address is not defined");
  const tempResult = ((await sdk.getPublisher().getAll(address)) || []).filter(
    (c) => c.id,
  );
  const tempResultWithMetadata = await Promise.all(
    tempResult.map(async (c) => ({
      ...c,
      metadata: await fetchFullPublishMetadata(sdk, c.metadataUri, queryClient),
    })),
  );

  const resultWithFeature = await Promise.all(
    tempResultWithMetadata.map(async (c) => ({
      ...c,
      deployMetadata: await fetchContractMetadata(
        c.metadata.metadataUri,
        StorageSingleton,
      ),
    })),
  );

  return resultWithFeature.filter((c) => {
    // @ts-expect-error - this is the "wrong" abi type, but it works fine
    const extensions = detectFeatures(c.deployMetadata.abi as Abi);
    // @ts-expect-error - this is the "wrong" abi type, but it works fine
    return isExtensionEnabled(c.deployMetadata.abi as Abi, feature, extensions);
  });
}

export type PublishedContractDetails = Awaited<
  ReturnType<typeof fetchPublishedContracts>
>[number];

export function usePublishedContractsQuery(
  address?: string,
  feature?: FeatureName,
) {
  const sdk = getThirdwebSDK(
    polygon.id,
    getDashboardChainRpc(polygon.id, undefined),
  );
  const queryClient = useQueryClient();
  return useQuery<PublishedContractDetails[]>({
    queryKey: ["published-contracts", address, feature],
    queryFn: () => {
      invariant(sdk, "sdk not provided");
      return feature && feature.length > 0
        ? fetchPublishedContractsWithFeature(sdk, queryClient, feature, address)
        : fetchPublishedContracts(sdk, queryClient, address);
    },
    enabled: !!address && !!sdk,
  });
}

const ALWAYS_SUGGESTED = ["ContractMetadata", "Permissions"];

function extractExtensions(
  input: ReturnType<typeof detectFeatures>,
  enabledExtensions: FeatureWithEnabled[] = [],
  suggestedExtensions: FeatureWithEnabled[] = [],
  parent = "__ROOT__",
) {
  if (!input) {
    return {
      enabledExtensions,
      suggestedExtensions,
    };
  }
  for (const extensionKey in input) {
    const extension = input[extensionKey];
    // if extension is enabled, then add it to enabledFeatures
    if (extension.enabled) {
      enabledExtensions.push(extension);
    }
    // otherwise if it is disabled, but it's parent is enabled or suggested, then add it to suggestedFeatures
    else if (
      enabledExtensions.findIndex((f) => f.name === parent) > -1 ||
      ALWAYS_SUGGESTED.includes(extension.name)
    ) {
      suggestedExtensions.push(extension);
    }
    // recurse
    extractExtensions(
      extension.features,
      enabledExtensions,
      suggestedExtensions,
      extension.name,
    );
  }

  return {
    enabledExtensions,
    suggestedExtensions,
  };
}

function useContractDetectedExtensions(abi?: Abi) {
  const features = useMemo(() => {
    if (abi) {
      // @ts-expect-error - this is the "wrong" abi type, but it works fine
      return extractExtensions(detectFeatures(abi));
    }
    return undefined;
  }, [abi]);
  return features;
}

export function useContractEnabledExtensions(abi?: Abi) {
  const extensions = useContractDetectedExtensions(abi);
  return extensions ? extensions.enabledExtensions : [];
}

export function ensQuery(addressOrEnsName?: string) {
  // if the address is `thirdweb.eth` we actually want `deployer.thirdweb.eth` here...
  if (addressOrEnsName === "thirdweb.eth") {
    // biome-ignore lint/style/noParameterAssign: FIXME
    addressOrEnsName = "deployer.thirdweb.eth";
  }
  const placeholderData = {
    address: isAddress(addressOrEnsName || "")
      ? addressOrEnsName || null
      : null,
    ensName: null,
  };
  return {
    queryKey: ["ens", addressOrEnsName],
    queryFn: async () => {
      if (!addressOrEnsName) {
        return placeholderData;
      }
      // if it is neither an address or an ens name then return the placeholder data only
      if (!isAddress(addressOrEnsName) && !isEnsName(addressOrEnsName)) {
        throw new Error("Invalid address or ENS name.");
      }

      const { address, ensName } = await resolveEns(addressOrEnsName).catch(
        () => ({
          address: isAddress(addressOrEnsName || "")
            ? addressOrEnsName || null
            : null,
          ensName: null,
        }),
      );

      if (isEnsName(addressOrEnsName) && !address) {
        throw new Error("Failed to resolve ENS name.");
      }

      return {
        address,
        ensName,
      };
    },
    enabled:
      !!addressOrEnsName &&
      (isAddress(addressOrEnsName) || isEnsName(addressOrEnsName)),
    // 24h
    cacheTime: 60 * 60 * 24 * 1000,
    // 1h
    staleTime: 60 * 60 * 1000,
    // default to the one we know already
    placeholderData,
    retry: false,
  } as const;
}

export function useEns(addressOrEnsName?: string) {
  return useQuery(ensQuery(addressOrEnsName));
}

export function useContractFunctions(abi: Abi) {
  return abi
    .filter((a) => a.type === "function")
    .map((f) => ({
      ...f,
      // fake "field" for the "signature"
      signature: `${f.name}(${f.inputs.map((i) => i.type).join(",")})`,
    }));
}

export function useContractEvents(abi: Abi) {
  return abi.filter((a) => a.type === "event");
}

export function useCustomFactoryAbi(contractAddress: string, chainId: number) {
  const chain = useV5DashboardChain(chainId);
  const contract = useMemo(() => {
    return getContract({
      client: thirdwebClient,
      address: contractAddress,
      chain,
    });
  }, [contractAddress, chain]);
  return useQuery({
    queryKey: ["custom-factory-abi", contract],
    queryFn: () => resolveContractAbi<Abi>(contract),
    enabled: !!contract,
  });
}
