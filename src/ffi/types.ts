// I am so so sorry about these types. They exist
// to infer the returned type of the library
// using the object that we pass in to describe the functions
type AsyncFfiCall<Args extends unknown[], ReturnType> = {
  async: (
    ...args: [...Args, (err: Error, ret: ReturnType) => void]
  ) => ReturnType;
};

type FfiFunction<T> = T extends (...a: infer Args) => infer ReturnType
  ? T & AsyncFfiCall<Args, ReturnType>
  : never;

type StringType = 'string' | 'void' | 'int' | 'double' | 'float';

type ActualType<T> = [T] extends ['string']
  ? string
  : [T] extends ['void']
  ? void
  : [T] extends ['int' | 'double' | 'float']
  ? number
  : never;

type ArrayActualType<Tuple extends [...Array<unknown>]> = {
  [Index in keyof Tuple]: ActualType<Tuple[Index]>;
} & { length: Tuple['length'] };

type TupleType = [StringType, Array<StringType>];

type FunctionFromArray<A extends TupleType> = A extends [
  r: infer ReturnTypeString,
  args: [...infer ArgArrayType]
]
  ? (...args: ArrayActualType<ArgArrayType>) => ActualType<ReturnTypeString>
  : never;

type LibDescription<Functions extends string> = {
  [k in Functions]: [StringType, Array<StringType>];
};

export type FfiBinding<T> = T extends LibDescription<string>
  ? {
      [Key in keyof T]: FfiFunction<FunctionFromArray<T[Key]>>;
    }
  : never;
