export type UUID = string & { readonly _brand: 'UUID' };

export function toUUID(value: string): UUID {
  return value as UUID;
}

export function newUUID(): UUID {
  return crypto.randomUUID() as UUID;
}
