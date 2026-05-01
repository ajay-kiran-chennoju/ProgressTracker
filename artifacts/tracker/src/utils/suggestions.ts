/**
 * Normalizes string for comparison (trim + lowercase)
 */
export const normalize = (str: string): string => str.trim().toLowerCase();

/**
 * Filter suggestions based on input
 * Logic: case-insensitive, prefix match, then fuzzy (includes)
 */
export const getSuggestions = (input: string, pool: string[]): string[] => {
  if (!input || !input.trim()) return [];
  
  const search = normalize(input);
  const uniquePool = [...new Set(pool)];

  // Prioritize prefix matches, then include partial matches
  const prefixMatches = uniquePool.filter(item => 
    normalize(item).startsWith(search)
  );
  
  const partialMatches = uniquePool.filter(item => 
    normalize(item).includes(search) && !normalize(item).startsWith(search)
  );

  return [...prefixMatches, ...partialMatches].slice(0, 10);
};

export const getCategorySuggestions = (input: string, existingCategories: string[]): string[] => {
  return getSuggestions(input, existingCategories);
};

export const getItemSuggestions = (input: string, existingItems: string[]): string[] => {
  return getSuggestions(input, existingItems);
};
