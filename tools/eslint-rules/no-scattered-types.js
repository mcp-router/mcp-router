module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce that type definitions are only allowed in specific directories",
      category: "Best Practices",
      recommended: true,
    },
    fixable: null,
    messages: {
      typeNotAllowed:
        "Type definitions ({{kind}}) are not allowed in this file. Move to packages/shared/src/types/ or other allowed locations.",
      interfaceNotAllowed:
        "Interface definitions are not allowed in this file except for component props. Move to packages/shared/src/types/ or other allowed locations.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedPaths: {
            type: "array",
            items: { type: "string" },
          },
          allowComponentProps: {
            type: "boolean",
            default: true,
          },
          allowedPatterns: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const allowedPaths = options.allowedPaths || [
      "packages/shared/src/types",
      "packages/remote-api-types/src",
      "apps/electron/src/lib/database/schema",
      "apps/electron/src/lib/platform-api/types",
      "tools/eslint-rules",
      ".d.ts",
    ];
    const allowComponentProps = options.allowComponentProps !== false;
    const allowedPatterns = options.allowedPatterns || [];

    const filename = context.getFilename();

    // Check if file is in allowed path
    const isAllowedPath = allowedPaths.some((path) => filename.includes(path));

    // Check if file matches allowed patterns
    const matchesAllowedPattern = allowedPatterns.some((pattern) => {
      const regex = new RegExp(pattern);
      return regex.test(filename);
    });

    if (isAllowedPath || matchesAllowedPattern) {
      return {};
    }

    // Check if file is a test file
    if (filename.includes(".test.") || filename.includes(".spec.")) {
      return {};
    }

    return {
      TSTypeAliasDeclaration(node) {
        // Allow specific utility types
        const typeName = node.id.name;
        if (
          typeName.endsWith("Props") &&
          allowComponentProps &&
          filename.endsWith(".tsx")
        ) {
          return;
        }

        context.report({
          node,
          messageId: "typeNotAllowed",
          data: { kind: "type alias" },
        });
      },

      TSInterfaceDeclaration(node) {
        const interfaceName = node.id.name;

        // Allow component props interfaces in .tsx files
        if (
          allowComponentProps &&
          filename.endsWith(".tsx") &&
          interfaceName.endsWith("Props")
        ) {
          return;
        }

        // Allow extending specific interfaces
        if (node.extends && node.extends.length > 0) {
          const extendsNames = node.extends.map((ext) => ext.expression.name);
          if (
            extendsNames.some((name) =>
              ["Window", "GlobalEventHandlers"].includes(name),
            )
          ) {
            return;
          }
        }

        context.report({
          node,
          messageId: "interfaceNotAllowed",
          data: { kind: "interface" },
        });
      },

      TSEnumDeclaration(node) {
        context.report({
          node,
          messageId: "typeNotAllowed",
          data: { kind: "enum" },
        });
      },
    };
  },
};
