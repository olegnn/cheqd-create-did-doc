import { createCheqdSDK, DIDModule } from "@cheqd/sdk";
import {
  createCheqdSDK as createOldCheqdSDK,
  DIDModule as OldDIDModule,
} from "@cheqd/sdk";
import {
  DidKeypair,
  Ed25519Keypair,
} from "@docknetwork/credential-sdk/keypairs";
import { MsgCreateDidDocPayload } from "@cheqd/ts-proto/cheqd/did/v2/index.js";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import {
  CheqdTestnetDid,
  DIDDocument,
  VerificationMethod,
  VerificationMethodSignature,
} from "@docknetwork/credential-sdk/types";
import { describe, test } from "vitest";
import { valueBytes } from "@docknetwork/credential-sdk/utils";

const createRandomDidDocument = async (createSDK) => {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
    process.env.CHEQD_MNEMONIC,
    { prefix: "cheqd" },
  );

  const cheqd = await createSDK({
    rpcUrl: "http://localhost:26657",
    wallet,
  });

  const did = CheqdTestnetDid.random();
  const kp = Ed25519Keypair.random();
  const didKp = new DidKeypair([did, 1], kp);
  const didDocument = DIDDocument.create(did, [didKp.didKey()]).toJSON();

  console.log(`Creating DID Document: ${JSON.stringify(didDocument, null, 2)}`);

  const { valid, error, protobufVerificationMethod, protobufService } =
    await DIDModule.validateSpecCompliantPayload(didDocument);

  if (!valid) {
    throw new Error(`DID payload is not spec compliant: ${error}`);
  }

  const payload = MsgCreateDidDocPayload.fromPartial({
    ...didDocument,
    verificationMethod: protobufVerificationMethod,
    service: protobufService,
  });

  const signature = {
    verificationMethodId: String(didKp.verificationMethodId),
    signature: valueBytes(
      didKp.sign(MsgCreateDidDocPayload.encode(payload).finish()),
    ),
  };

  await cheqd.createDidDocTx(
    [signature],
    didDocument,
    (await wallet.getAccounts())[0].address,
    undefined,
    undefined,
    { sdk: cheqd },
  );
};

describe("Create DID Document", () => {
  test(
    "Using old SDK",
    () =>
      createRandomDidDocument((params) =>
        createOldCheqdSDK({ ...params, modules: [OldDIDModule] }),
      ),
    {
      timeout: 10e3,
    },
  );

  test(
    "Using new SDK",
    () =>
      createRandomDidDocument((params) =>
        createCheqdSDK({ ...params, modules: [DIDModule] }),
      ),
    {
      timeout: 10e3,
    },
  );
});
