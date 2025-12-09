import globals from "globals";
import standard from "eslint-config-love";

export default [
	{
		...standard,
		files: ["**/*.{js,mjs,cjs,ts}"],
		ignores: [
			"dist/**",
			"eslint.config.js",
			"src/__tests__/**"
		],
		languageOptions: {
			...standard.languageOptions,
			parserOptions: {
				...standard.languageOptions?.parserOptions,
				extraFileExtensions: [".json", ".md", ".yml", ".yaml"]
			},
			globals: {
				...globals.node,
				...standard.languageOptions?.globals,
			},
		},
		rules: {
			...standard.rules,
			"@typescript-eslint/no-magic-numbers": ["error", { "ignore": [-1, 0, 1, 24, 60, 1000, 3600000, 86400000], ignoreDefaultValues: true, ignoreArrayIndexes: true } ],
			"no-magic-numbers": "off", // Must be off for compatibility with ts rules.
			"no-mixed-spaces-and-tabs": "error",
			"no-console": "off",
			"@typescript-eslint/no-console": "off",
			//"@typescript-eslint/ban-ts-comment": "off",
			//"ban-ts-comment": "off",
			"indent": ["error", "tab", { "MemberExpression": 0 }],
			//"prefer-destructuring": "off",
			//"@typescript-eslint/prefer-destructuring": "off",
			"complexity": ["error", 6]
		}
	},
	{
		files: ["**/constants/**/*.{js,ts}"],
		rules: {
			"@typescript-eslint/no-magic-numbers": "off"
		}
	}
];