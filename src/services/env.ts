import { cleanEnv, str } from "envalid";

const ENV = cleanEnv(import.meta.env, {
  VITE_PINATA_JWT: str(),
  VITE_PINATA_KEY: str(),
  VITE_PINATA_SECRET: str(),
  VITE_PINATA_GATEWAY: str({default: 'chocolate-nearby-ladybug-431.mypinata.cloud'}),
  AXIOM_TOKEN: str(),
  AXIOM_DATASET: str({default: 'pinpin'}),
  LOG_LEVEL: str({default: 'info'}),
});

export default ENV;
