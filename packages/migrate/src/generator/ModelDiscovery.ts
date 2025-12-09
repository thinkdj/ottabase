import path from 'path';
import { pathToFileURL } from 'url';
import type { MigrateConfig, ModelConfig } from '../config/types';

export interface DiscoveredModel {
  name: string;           // Model class name (e.g., "User")
  className: string;      // Same as name
  tableName: string;      // Table name (e.g., "users" from Model.entity)
  feature: string;        // Feature group (core, auth, app)
  source: string;         // Package name or file path
  tableSchema: any;       // Drizzle table definition
}

export class ModelDiscovery {
  /**
   * Discover all models defined in the configuration
   */
  async discover(config: MigrateConfig, appDir: string): Promise<DiscoveredModel[]> {
    const models: DiscoveredModel[] = [];

    for (const modelConfig of config.models) {
      const discoveredModels = await this.discoverFromConfig(modelConfig, appDir);
      models.push(...discoveredModels);
    }

    return models;
  }

  /**
   * Discover models from a single model configuration
   */
  private async discoverFromConfig(
    modelConfig: ModelConfig,
    appDir: string
  ): Promise<DiscoveredModel[]> {
    const models: DiscoveredModel[] = [];
    let imported: any;

    try {
      if (modelConfig.import) {
        // Import from package (e.g., "@ottabase/ottaorm/models")
        imported = await import(modelConfig.import);
      } else if (modelConfig.path) {
        // Import from local path (e.g., "./ottabase/models")
        const resolved = path.resolve(appDir, modelConfig.path);
        const fileUrl = pathToFileURL(resolved).href;
        imported = await import(fileUrl);
      }

      // Extract each model
      for (const modelName of modelConfig.models) {
        const ModelClass = imported[modelName];

        if (!ModelClass) {
          throw new Error(
            `Model "${modelName}" not found in ${modelConfig.import || modelConfig.path}`
          );
        }

        // Validate that the model has required static properties
        if (!ModelClass.entity) {
          throw new Error(
            `Model "${modelName}" must have a static 'entity' property with the table name`
          );
        }

        if (!ModelClass.table) {
          throw new Error(
            `Model "${modelName}" must have a static 'table' property with the Drizzle table schema`
          );
        }

        models.push({
          name: modelName,
          className: modelName,
          tableName: ModelClass.entity,
          feature: modelConfig.feature,
          source: modelConfig.import || modelConfig.path!,
          tableSchema: ModelClass.table,
        });
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to discover models from ${modelConfig.import || modelConfig.path}: ${error.message}`
        );
      }
      throw error;
    }

    return models;
  }

  /**
   * Get models filtered by feature
   */
  async discoverByFeature(
    config: MigrateConfig,
    appDir: string,
    feature: string
  ): Promise<DiscoveredModel[]> {
    const allModels = await this.discover(config, appDir);
    return allModels.filter((model) => model.feature === feature);
  }

  /**
   * Get all unique features from discovered models
   */
  async getFeatures(config: MigrateConfig, appDir: string): Promise<string[]> {
    const allModels = await this.discover(config, appDir);
    const features = new Set(allModels.map((model) => model.feature));
    return Array.from(features).sort();
  }
}
