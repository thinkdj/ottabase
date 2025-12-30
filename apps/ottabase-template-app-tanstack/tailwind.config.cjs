const sharedPreset = require("@ottabase/ui-tailwind/tailwind.base.cjs");

module.exports = {
  presets: [sharedPreset],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui-core/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui-code-highlight/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui-components/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui-tailwind/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui-shadcn/components/**/*.{js,ts,jsx,tsx}",
    "../../packages/ottaselect/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
};
