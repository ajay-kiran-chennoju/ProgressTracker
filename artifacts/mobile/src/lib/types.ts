export type RootStackParamList = {
  Home: undefined;
  Day: { date: string; newCategory?: any; newItem?: any; newItemCategoryId?: string };
  Category: { categoryId: string; title: string; newTask?: any };
  Settings: undefined;
  AddCategory: { date: string; slot: 'A' | 'B'; callbackKey?: string };
  AddEntry: { categoryId: string; categoryTitle: string; date: string; callbackKey?: string };
  AddTask: { categoryId: string; categoryTitle: string; date: string; callbackKey?: string };
};
