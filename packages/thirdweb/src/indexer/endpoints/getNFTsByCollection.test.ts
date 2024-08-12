import { describe, expect, it } from "vitest";

import { defineChain } from "src/chains/utils.js";
import { getContract } from "src/contract/contract.js";
import { TEST_CLIENT } from "~test/test-clients.js";
import { getNFTsByCollection } from "./getNFTsByCollection.js";

describe.runIf(process.env.TW_SECRET_KEY)(
  "chainsaw.getNFTsByCollection",
  () => {
    it("gets NFTs for collection", async () => {
      const contractAddress = "0x00000000001594c61dd8a6804da9ab58ed2483ce";
      const contract = getContract({
        client: TEST_CLIENT,
        chain: defineChain(252),
        address: contractAddress,
      });

      const { nfts } = await getNFTsByCollection({
        client: TEST_CLIENT,
        contract,
      });

      for (const nft of nfts) {
        expect(nft.id).toBeTypeOf("bigint");
        expect(nft.tokenURI).toBeTypeOf("string");
        expect(nft.type).toEqual("ERC721");
        expect(nft.metadata?.contractAddress).toEqual(
          contractAddress.toLowerCase(),
        );
        expect(nft.metadata?.chainId).toEqual(252);
        expect(nft.metadata?.balance).toBeTypeOf("bigint");
        expect(nft.metadata).toMatchObject(
          expect.objectContaining({
            id: expect.any(BigInt),
            uri: expect.any(String),
          }),
        );
      }
      expect(true).toEqual(true);
    });

    it("fails for unsupported chain", async () => {
      const contractAddress = "0x00000000001594c61dd8a6804da9ab58ed2483ce";
      const contract = getContract({
        client: TEST_CLIENT,
        address: contractAddress,
        chain: defineChain(12312),
      });

      await expect(
        getNFTsByCollection({
          client: TEST_CLIENT,
          contract,
        }),
      ).rejects.toThrow("Fetch failed");
    });
  },
);
