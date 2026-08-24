import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  { ignores: [".open-next/**", ".wrangler/**", "node_modules/**"] },
  {
    rules: {
      // This project fetches data on mount with plain useEffect + fetch (no
      // data-fetching library). That is the intended pattern here, not a bug.
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default eslintConfig;
