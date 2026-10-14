import { Skeleton } from 'wallet-web-ui';

export const Line = () => (
  <div className="max-w-md">
    <Skeleton />
  </div>
);

export const Card = () => (
  <div className="max-w-md">
    <Skeleton variant="card" />
  </div>
);

export const TextBlock = () => (
  <div className="grid max-w-md gap-3">
    <Skeleton />
    <Skeleton className="max-w-sm" />
    <Skeleton className="max-w-56" />
  </div>
);

export const AccountCards = () => (
  <div className="grid gap-4 sm:grid-cols-2">
    <Skeleton variant="card" />
    <Skeleton variant="card" />
  </div>
);

export const MovementList = () => (
  <ul className="grid max-w-xl">
    {['mov-1', 'mov-2', 'mov-3'].map((key) => (
      <li key={key} className="grid grid-cols-4 gap-4 border-b border-border py-3">
        <div className="col-span-3 grid gap-2">
          <Skeleton className="max-w-56" />
          <Skeleton className="max-w-sm" />
        </div>
        <div className="grid justify-items-end gap-2">
          <Skeleton />
        </div>
      </li>
    ))}
  </ul>
);
