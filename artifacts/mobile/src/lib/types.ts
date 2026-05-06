export type RootStackParamList = {
  Home: undefined;
  Day: { date: string };
  Category: { categoryId: string; title: string };
  Settings: undefined;
  AddCategory: { date: string; slot: 'A' | 'B' };
  AddEntry: { categoryId: string; categoryTitle: string; date: string };
};
