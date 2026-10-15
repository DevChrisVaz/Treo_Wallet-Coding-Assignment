/*
 * Superficie del sistema de diseño de la web que se sincroniza con Claude Design: el inventario de
 * components/ui (con StepActions, las acciones de los pasos del flujo), los estados, las estructuras
 * de página (AppShell con sesión y BrandShell pública), StepHeading y las piezas de las funciones
 * propias de la web (ScheduleField y StatementDownload).
 * Lo que no está aquí no llega al bundle.
 */
export { AccountCard, type AccountCardProps } from '@/components/ui/AccountCard';
export { AmountField, type AmountFieldProps } from '@/components/ui/AmountField';
export { AppHeader, type AppHeaderProps } from '@/components/ui/AppHeader';
export { Avatar, initials, type AvatarProps } from '@/components/ui/Avatar';
export { BalanceHero, type BalanceHeroProps } from '@/components/ui/BalanceHero';
export { BottomSheet, type BottomSheetProps } from '@/components/ui/BottomSheet';
export { Button, buttonClasses, type ButtonProps, type ButtonVariant } from '@/components/ui/Button';
export { DailyLimitMeter } from '@/components/ui/DailyLimitMeter';
export { EmptyState, type EmptyStateProps } from '@/components/ui/EmptyState';
export { FlowHeader, type FlowHeaderProps } from '@/components/ui/FlowHeader';
export { Icon, IconButton, type IconButtonProps, type IconProps } from '@/components/ui/Icon';
export { InlineAlert, type AlertTone, type InlineAlertProps } from '@/components/ui/InlineAlert';
export { ListSection, type ListSectionProps } from '@/components/ui/ListSection';
export { MovementList } from '@/components/ui/MovementList';
export { MovementRow } from '@/components/ui/MovementRow';
export { OtpField, type OtpFieldProps } from '@/components/ui/OtpField';
export { QuickActions, type QuickAction } from '@/components/ui/QuickActions';
export { Receipt, type ReceiptProps } from '@/components/ui/Receipt';
export { SearchField, type SearchFieldProps } from '@/components/ui/SearchField';
export { Select, type SelectProps } from '@/components/ui/Select';
export { SideNav, type SideNavProps } from '@/components/ui/SideNav';
export { Skeleton, type SkeletonProps } from '@/components/ui/Skeleton';
export { StatusBadge } from '@/components/ui/StatusBadge';
export { StepActions, type StepActionsProps } from '@/components/ui/StepActions';
export { Stepper } from '@/components/ui/Stepper';
export { TabBar, type NavItem, type TabBarProps } from '@/components/ui/TabBar';
export { TextField, type TextFieldProps } from '@/components/ui/TextField';
export { TopBar } from '@/components/ui/TopBar';
export { Wordmark, type WordmarkProps } from '@/components/ui/Wordmark';
export { ErrorState, LoadingState } from '@/components/states/states';
export { AppShell, DEFAULT_NAV_ITEMS, type AppShellProps } from '@/components/layout/AppShell';
export { BrandShell } from '@/components/layout/BrandShell';
export { StepHeading } from '@/components/transfers/StepHeading';
// Funciones propias de la web (bonus): "Cuándo" del paso de monto (WEB-33) y el estado de cuenta de
// Movimientos (WEB-32).
export { ScheduleField, type ScheduleFieldProps } from '@/components/transfers/ScheduleField';
export { StatementDownload } from '@/components/accounts/StatementDownload';
/*
 * Aritmética y formato de montos (no son componentes): suma en centavos para el saldo total del
 * hero y las primitivas del contrato (BigInt, nunca Number) para restar y mostrar montos.
 */
export { sumAmounts } from '@/lib/money';
export { centsToDecimalString, formatMXN, toCents } from '@devchrisvaz/wallet-contract';
