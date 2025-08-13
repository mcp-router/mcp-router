import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { usePlatformAPI } from "@/renderer/platform-api";
import { useWorkspaceStore } from "../../../stores";
import {
  MCPDisplayRules,
  DEFAULT_DISPLAY_RULES,
  RuleVariables,
  ToolParameterSchemaRule,
} from "@mcp_router/shared";
import { Input } from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { Label } from "@mcp_router/ui";
import { Info, RotateCcw, Save } from "lucide-react";
import { Badge } from "@mcp_router/ui";
import { Separator } from "@mcp_router/ui";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@mcp_router/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@mcp_router/ui";
import { Textarea } from "@mcp_router/ui";
import { Checkbox } from "@mcp_router/ui";

/**
 * Get sample data for preview display based on current language
 */
const getSampleData = (language: string): Record<string, RuleVariables> => {
  // Return Japanese sample data if language is Japanese, otherwise return English
  if (language === "ja") {
    return {
      tool: {
        name: "サンプルツール",
        description: "サンプルツールの説明です",
        serverName: "サンプルサーバー",
      },
      resource: {
        name: "サンプルリソース",
        description: "サンプルリソースの説明です",
        serverName: "サンプルサーバー",
      },
      prompt: {
        name: "サンプルプロンプト",
        description: "サンプルプロンプトの説明です",
        serverName: "サンプルサーバー",
      },
      resourceTemplate: {
        name: "サンプルテンプレート",
        description: "サンプルテンプレートの説明です",
        serverName: "サンプルサーバー",
      },
    };
  }

  // Default to English sample data
  return {
    tool: {
      name: "SampleTool",
      description: "This is a description of the sample tool",
      serverName: "SampleServer",
    },
    resource: {
      name: "SampleResource",
      description: "This is a description of the sample resource",
      serverName: "SampleServer",
    },
    prompt: {
      name: "SamplePrompt",
      description: "This is a description of the sample prompt",
      serverName: "SampleServer",
    },
    resourceTemplate: {
      name: "SampleTemplate",
      description: "This is a description of the sample template",
      serverName: "SampleServer",
    },
  };
};

/**
 * Get available variables with translated descriptions
 */
const getAvailableVariables = (t: any) => [
  { name: "name", description: t("rules.tooltip.entityName") },
  { name: "description", description: t("rules.tooltip.entityDescription") },
  { name: "serverName", description: t("rules.tooltip.serverName") },
];

/**
 * Rule editor component
 */
interface RuleEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  variables: RuleVariables;
  placeholder?: string;
}

const RuleEditor: React.FC<RuleEditorProps> = ({
  label,
  value,
  onChange,
  variables,
  placeholder,
}) => {
  const { t } = useTranslation();

  // Get available variables with translations
  const AVAILABLE_VARIABLES = getAvailableVariables(t);

  // Simple implementation of rule application for preview
  // This avoids using the Node.js implementation directly in renderer
  const preview = value.replace(
    /\{([a-zA-Z]+)\}/g,
    (match, variable: string) => {
      return variables[variable] !== undefined ? variables[variable] : match;
    },
  );

  return (
    <div className="space-y-2 mb-4">
      <div className="flex items-center justify-between">
        <Label htmlFor={label}>{label}</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-4 h-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <div className="max-w-xs space-y-2 p-1">
                <p className="text-sm font-medium">
                  {t("rules.tooltip.availableVariables")}
                </p>
                <ul className="text-xs space-y-1">
                  {AVAILABLE_VARIABLES.map((variable) => (
                    <li key={variable.name}>
                      <code className="bg-muted text-primary px-1 py-0.5 rounded">{`{${variable.name}}`}</code>
                      <span className="ml-1">{variable.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Input
        id={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "{name}"}
        className="mb-1"
      />
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {t("rules.fields.preview")}
        </span>
        <Badge variant="outline" className="text-xs font-normal">
          {preview}
        </Badge>
      </div>
    </div>
  );
};

/**
 * Tool Parameter Section component
 */
interface ToolParameterSectionProps {
  title: string;
  parameterRule: ToolParameterSchemaRule;
  onParameterRuleChange: (value: ToolParameterSchemaRule) => void;
}

const ToolParameterSection: React.FC<ToolParameterSectionProps> = ({
  title,
  parameterRule,
  onParameterRuleChange,
}) => {
  const { t } = useTranslation();
  const [newPropertyName, setNewPropertyName] = useState("");
  const [newPropertyType, setNewPropertyType] = useState("string");
  const [newPropertyDescription, setNewPropertyDescription] = useState("");

  // Deep clone the value to avoid direct mutation
  const ruleValue = JSON.parse(JSON.stringify(parameterRule));
  if (!ruleValue.properties) ruleValue.properties = {};
  if (!ruleValue.required) ruleValue.required = [];

  // Add a new property to the schema
  const addProperty = () => {
    if (!newPropertyName.trim()) return;

    const updatedProperties = {
      ...ruleValue.properties,
      [newPropertyName]: {
        type: newPropertyType,
        description: newPropertyDescription,
      },
    };

    onParameterRuleChange({
      ...ruleValue,
      properties: updatedProperties,
    });

    // Reset form
    setNewPropertyName("");
    setNewPropertyType("string");
    setNewPropertyDescription("");
  };

  // Remove a property from the schema
  const removeProperty = (propertyName: string) => {
    const updatedProperties = { ...ruleValue.properties };
    delete updatedProperties[propertyName];

    // Also remove from required if it's there
    const updatedRequired = ruleValue.required.filter(
      (name: string) => name !== propertyName,
    );

    onParameterRuleChange({
      ...ruleValue,
      properties: updatedProperties,
      required: updatedRequired,
    });
  };

  // Toggle a property as required/optional
  const toggleRequired = (propertyName: string) => {
    const isRequired = ruleValue.required.includes(propertyName);

    if (isRequired) {
      const updatedRequired = ruleValue.required.filter(
        (name: string) => name !== propertyName,
      );

      onParameterRuleChange({
        ...ruleValue,
        required: updatedRequired,
      });
    } else {
      onParameterRuleChange({
        ...ruleValue,
        required: [...ruleValue.required, propertyName],
      });
    }
  };

  // Property type options
  const propertyTypes = [
    { value: "string", label: t("rules.types.string") },
    { value: "number", label: t("rules.types.number") },
    { value: "boolean", label: t("rules.types.boolean") },
    { value: "object", label: t("rules.types.object") },
    { value: "array", label: t("rules.types.array") },
  ];

  return (
    <div className="space-y-6">
      {/* Add new property form */}
      <div className="rounded-md border p-4 space-y-4">
        <h4 className="font-medium">
          {t("rules.addNewParameter") || "Add New Parameter"}
        </h4>
        <p className="text-sm">{t("rules.parameterDescription")}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="property-name">
              {t("rules.fields.name") || "Name"}
            </Label>
            <Input
              id="property-name"
              value={newPropertyName}
              onChange={(e) => setNewPropertyName(e.target.value)}
              placeholder="e.g. thought"
            />
          </div>

          <div>
            <Label htmlFor="property-type">
              {t("rules.fields.type") || "Type"}
            </Label>
            <select
              id="property-type"
              value={newPropertyType}
              onChange={(e) => setNewPropertyType(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {propertyTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="property-description">
            {t("rules.fields.description") || "Description"}
          </Label>
          <Input
            id="property-description"
            value={newPropertyDescription}
            onChange={(e) => setNewPropertyDescription(e.target.value)}
            placeholder="e.g. Your thought process"
          />
        </div>

        <Button
          onClick={addProperty}
          disabled={!newPropertyName.trim()}
          variant="outline"
          size="sm"
        >
          {t("common.add") || "Add"}
        </Button>
      </div>

      {/* Current properties list */}
      {Object.keys(ruleValue.properties).length > 0 ? (
        <div className="rounded-md border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="py-2 px-4 text-left font-medium">
                  {t("rules.fields.name")}
                </th>
                <th className="py-2 px-4 text-left font-medium">
                  {t("rules.fields.type")}
                </th>
                <th className="py-2 px-4 text-left font-medium">
                  {t("rules.fields.description")}
                </th>
                <th className="py-2 px-4 text-left font-medium">
                  {t("rules.fields.required")}
                </th>
                <th className="py-2 px-4 text-left font-medium">
                  {t("rules.fields.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(ruleValue.properties).map(
                ([name, prop]: [string, any]) => (
                  <tr key={name} className="border-b">
                    <td className="py-2 px-4 font-mono text-sm">{name}</td>
                    <td className="py-2 px-4 font-mono text-sm">{prop.type}</td>
                    <td className="py-2 px-4">{prop.description}</td>
                    <td className="py-2 px-4">
                      <Checkbox
                        checked={ruleValue.required.includes(name)}
                        onCheckedChange={() => toggleRequired(name)}
                      />
                    </td>
                    <td className="py-2 px-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProperty(name)}
                        className="h-8 px-2 text-destructive"
                      >
                        {t("common.remove") || "Remove"}
                      </Button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
          {t("rules.noParametersAdded") || "No additional parameters defined."}
        </div>
      )}
    </div>
  );
};

/**
 * Entity type section
 */
interface EntityTypeSectionProps {
  title: string;
  entityType: keyof typeof SAMPLE_DATA_TYPES;
  nameRule: string;
  descriptionRule: string;
  onNameRuleChange: (value: string) => void;
  onDescriptionRuleChange: (value: string) => void;
}

// Define sample data types to ensure type safety
const SAMPLE_DATA_TYPES = {
  tool: {},
  resource: {},
  prompt: {},
  resourceTemplate: {},
};

const EntityTypeSection: React.FC<EntityTypeSectionProps> = ({
  title,
  entityType,
  nameRule,
  descriptionRule,
  onNameRuleChange,
  onDescriptionRuleChange,
}) => {
  const { i18n, t } = useTranslation();

  // Get sample data for the entity type based on current language
  const SAMPLE_DATA = getSampleData(i18n.language);
  const variables = SAMPLE_DATA[entityType];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">{title}</h3>
      <RuleEditor
        label={t("rules.fields.nameRule")}
        value={nameRule}
        onChange={onNameRuleChange}
        variables={variables}
        placeholder="{name}"
      />
      <RuleEditor
        label={t("rules.fields.descriptionRule")}
        value={descriptionRule}
        onChange={onDescriptionRuleChange}
        variables={variables}
        placeholder="[{serverName}] {description}"
      />
    </div>
  );
};

/**
 * Main Rules component
 */
const Rules: React.FC = () => {
  const { t, i18n } = useTranslation();
  const platformAPI = usePlatformAPI();
  const { currentWorkspace } = useWorkspaceStore();
  const [rules, setRules] = useState<MCPDisplayRules>({
    ...DEFAULT_DISPLAY_RULES,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Removed selectedTab state as tabs are no longer used
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await platformAPI.settings.get();
        if (settings.mcpDisplayRules) {
          setRules({
            ...DEFAULT_DISPLAY_RULES,
            ...settings.mcpDisplayRules,
          });
        }
        setHasUnsavedChanges(false);
      } catch (error) {
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [t, currentWorkspace?.id]);

  // Force re-render when language changes to update sample data and translations
  useEffect(() => {
    // Re-render component when language changes to update previews with new sample data
  }, [i18n.language]);

  // Save settings
  const saveRules = async () => {
    try {
      setSaving(true);

      // No validation needed for tool parameter rules as they are schema-based
      // Remove the tool name rule validation since we're not using display rules anymore

      const settings = await platformAPI.settings.get();
      const updatedSettings = {
        ...settings,
        mcpDisplayRules: rules,
      };

      const success = await platformAPI.settings.save(updatedSettings);

      if (success) {
        toast.success("Settings saved successfully");
        setHasUnsavedChanges(false);
      } else {
        throw new Error("Failed to save settings");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save settings",
      );
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults
  const resetToDefaults = () => {
    setRules({ ...DEFAULT_DISPLAY_RULES });
    saveRules();
  };

  // Utility function to update rules
  const updateRule = (key: keyof MCPDisplayRules, value: string) => {
    setRules((prev) => ({
      ...prev,
      [key]: value,
    }));
    setHasUnsavedChanges(true);
  };

  // Export rules to clipboard (only tool parameter rule)
  const exportRules = () => {
    const toolParameterOnlyRules = {
      toolParameterRule: rules.toolParameterRule,
    };
    const text = JSON.stringify(toolParameterOnlyRules, null, 2);
    navigator.clipboard.writeText(text);
    toast.success(t("common.copiedToClipboard"));
  };

  // Import rules from textarea (only tool parameter rule)
  const importRules = () => {
    try {
      const parsed = JSON.parse(importText);
      // Only update tool parameter rule
      const updatedRules = { ...rules };
      if (parsed.toolParameterRule !== undefined)
        updatedRules.toolParameterRule = parsed.toolParameterRule;

      setRules(updatedRules);
      setIsImportDialogOpen(false);
      setImportText("");
      setHasUnsavedChanges(true);
      toast.success(t("rules.success.imported"));
    } catch {
      toast.error(t("rules.errors.importFailed"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t("rules.title")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportRules}>
            {t("rules.export")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportDialogOpen(true)}
          >
            {t("rules.import")}
          </Button>
        </div>
      </div>

      {/* Only show tool parameter rules - tool display rules removed */}
      <div className="space-y-8">
        <ToolParameterSection
          title={t("rules.sections.toolParameters")}
          parameterRule={
            rules.toolParameterRule ?? DEFAULT_DISPLAY_RULES.toolParameterRule!
          }
          onParameterRuleChange={(value) => {
            setRules((prev) => ({
              ...prev,
              toolParameterRule: value,
            }));
            setHasUnsavedChanges(true);
          }}
        />
      </div>

      {/* Commented out - Resource rules
      <TabsContent value="resource">
        <EntityTypeSection
          title={t('rules.sections.resourceDisplayRules')}
          entityType="resource"
          nameRule={rules.resourceNameRule || DEFAULT_DISPLAY_RULES.resourceNameRule}
          descriptionRule={rules.resourceDescriptionRule || DEFAULT_DISPLAY_RULES.resourceDescriptionRule}
          onNameRuleChange={(value) => updateRule('resourceNameRule', value)}
          onDescriptionRuleChange={(value) => updateRule('resourceDescriptionRule', value)}
        />
      </TabsContent>
      */}

      {/* Commented out - Prompt rules
      <TabsContent value="prompt">
        <EntityTypeSection
          title={t('rules.sections.promptDisplayRules')}
          entityType="prompt"
          nameRule={rules.promptNameRule || DEFAULT_DISPLAY_RULES.promptNameRule}
          descriptionRule={rules.promptDescriptionRule || DEFAULT_DISPLAY_RULES.promptDescriptionRule}
          onNameRuleChange={(value) => updateRule('promptNameRule', value)}
          onDescriptionRuleChange={(value) => updateRule('promptDescriptionRule', value)}
        />
      </TabsContent>
      */}

      {/* Commented out - Resource template rules
      <TabsContent value="resourceTemplate">
        <EntityTypeSection
          title={t('rules.sections.templateDisplayRules')}
          entityType="resourceTemplate"
          nameRule={rules.resourceTemplateNameRule || DEFAULT_DISPLAY_RULES.resourceTemplateNameRule}
          descriptionRule={rules.resourceTemplateDescriptionRule || DEFAULT_DISPLAY_RULES.resourceTemplateDescriptionRule}
          onNameRuleChange={(value) => updateRule('resourceTemplateNameRule', value)}
          onDescriptionRuleChange={(value) => updateRule('resourceTemplateDescriptionRule', value)}
        />
      </TabsContent>
      */}

      <Separator className="my-6" />

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={resetToDefaults} disabled={saving}>
          <RotateCcw className="mr-2 h-4 w-4" />
          {t("common.reset")}
        </Button>
        <Button onClick={saveRules} disabled={saving || !hasUnsavedChanges}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rules.import")}</DialogTitle>
            <DialogDescription>
              {t("rules.importDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              id="import-rules"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="h-40 max-h-40 overflow-y-auto resize-none"
              placeholder={t("rules.importPlaceholder")}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsImportDialogOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={importRules}>{t("rules.import")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Rules;
