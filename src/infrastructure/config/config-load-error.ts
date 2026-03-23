export type ConfigLoadError =
  | { readonly kind: 'missing_file'; readonly message: string; readonly path: string }
  | { readonly kind: 'invalid_yaml'; readonly message: string; readonly path: string }
  | { readonly kind: 'validation'; readonly message: string; readonly path: string };
