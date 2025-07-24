import { cleanEnv, str } from "envalid";

const ENV = cleanEnv(import.meta.env, {
  VITE_PINATA_JWT: str(),
  VITE_PINATA_KEY: str(),
  VITE_PINATA_SECRET: str(),
  VITE_PINATA_GATEWAY: str({default: 'chocolate-nearby-ladybug-431.mypinata.cloud'}),
  VITE_AXIOM_TOKEN: str(),
  VITE_AXIOM_DATASET: str({default: 'pinpin'}),
  VITE_LOG_LEVEL: str({default: 'info'}),
});

export default ENV;
