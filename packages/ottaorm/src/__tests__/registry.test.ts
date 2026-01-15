import { beforeEach, describe, expect, it } from "vitest";
import { BaseModel } from "../base/BaseModel";
import {
  clearModelRegistry,
  getModel,
  getRegisteredModels,
  hasModel,
  registerModel,
  registerModels,
} from "../registry";

class TestModel extends BaseModel {
  static entity = "test";
  static table = {} as any;
  static primaryKey = "id";
}

class UserModel extends BaseModel {
  static entity = "user";
  static table = {} as any;
  static primaryKey = "id";
}

class PostModel extends BaseModel {
  static entity = "post";
  static table = {} as any;
  static primaryKey = "id";
}

class CommentModel extends BaseModel {
  static entity = "comment";
  static table = {} as any;
  static primaryKey = "id";
}

describe("OttaORM Model Registry", () => {
  beforeEach(() => {
    clearModelRegistry();
  });

  describe("registerModel", () => {
    it("should register a single model", () => {
      registerModel(TestModel);

      expect(hasModel("test")).toBe(true);
    });

    it("should store model with correct name", () => {
      registerModel(UserModel);

      expect(getModel("user")).toEqual(UserModel);
    });

    it("should handle duplicate registrations", () => {
      class Model1 extends BaseModel {
        static entity = "test";
        static table = {} as any;
        static primaryKey = "id";
      }

      class Model2 extends BaseModel {
        static entity = "test";
        static table = {} as any;
        static primaryKey = "id";
      }

      registerModel(Model1);
      registerModel(Model2);

      expect(getModel("test")).toEqual(Model2);
    });
  });

  describe("registerModels", () => {
    it("should register multiple models at once", () => {
      registerModels([UserModel, PostModel, CommentModel]);

      expect(hasModel("user")).toBe(true);
      expect(hasModel("post")).toBe(true);
      expect(hasModel("comment")).toBe(true);
    });

    it("should handle empty object", () => {
      expect(() => registerModels([])).not.toThrow();
    });
  });

  describe("getModel", () => {
    it("should retrieve registered model", () => {
      registerModel(TestModel);

      const model = getModel("test");
      expect(model).toEqual(TestModel);
    });

    it("should return undefined for unregistered model", () => {
      expect(getModel("nonexistent")).toBeUndefined();
    });
  });

  describe("hasModel", () => {
    it("should detect registered models", () => {
      registerModel(TestModel);
      expect(hasModel("test")).toBe(true);
    });

    it("should return false for unregistered models", () => {
      expect(hasModel("nonexistent")).toBe(false);
    });
  });

  describe("getRegisteredModels", () => {
    it("should return all registered models", () => {
      registerModels([UserModel, PostModel]);
      const registered = getRegisteredModels();

      expect(registered).toContain("user");
      expect(registered).toContain("post");
    });

    it("should return empty object when no models registered", () => {
      const registered = getRegisteredModels();
      expect(registered).toHaveLength(0);
    });
  });

  describe("clearModelRegistry", () => {
    it("should clear all registered models", () => {
      class Test1Model extends BaseModel {
        static entity = "test1";
        static table = {} as any;
        static primaryKey = "id";
      }

      class Test2Model extends BaseModel {
        static entity = "test2";
        static table = {} as any;
        static primaryKey = "id";
      }

      registerModel(Test1Model);
      registerModel(Test2Model);

      clearModelRegistry();

      expect(hasModel("test1")).toBe(false);
      expect(hasModel("test2")).toBe(false);
    });

    it("should allow re-registration after clearing", () => {
      class NewTestModel extends BaseModel {
        static entity = "test";
        static table = {} as any;
        static primaryKey = "id";
      }

      registerModel(TestModel);
      clearModelRegistry();
      registerModel(NewTestModel);

      expect(hasModel("test")).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle special characters in model names", () => {
      class UserProfileModel extends BaseModel {
        static entity = "user_profile";
        static table = {} as any;
        static primaryKey = "id";
      }

      registerModel(UserProfileModel);

      expect(hasModel("user_profile")).toBe(true);
    });

    it("should be case-sensitive", () => {
      class UpperUserModel extends BaseModel {
        static entity = "User";
        static table = {} as any;
        static primaryKey = "id";
      }

      registerModel(UpperUserModel);

      expect(hasModel("User")).toBe(true);
      expect(hasModel("user")).toBe(false);
    });
  });
});
