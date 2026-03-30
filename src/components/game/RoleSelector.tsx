import { Role, ROLE_LABELS } from '@/types/game';
import { cn } from '@/lib/utils';
import { Package, Truck, Building2, Factory } from 'lucide-react';

interface RoleSelectorProps {
  selectedRole: Role;
  onRoleSelect: (role: Role) => void;
  disabledRoles?: Role[];
}

const ROLE_ICONS: Record<Role, React.ReactNode> = {
  retailer: <Package className="h-8 w-8" />,
  wholesaler: <Truck className="h-8 w-8" />,
  distributor: <Building2 className="h-8 w-8" />,
  factory: <Factory className="h-8 w-8" />,
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  retailer: 'Closest to customers. You see actual demand first.',
  wholesaler: 'Middle of the chain. Balance supply and demand.',
  distributor: 'Bulk operations. Manage large inventory flows.',
  factory: 'Source of supply. You produce the goods.',
};

export function RoleSelector({ selectedRole, onRoleSelect, disabledRoles = [] }: RoleSelectorProps) {
  const roles: Role[] = ['retailer', 'wholesaler', 'distributor', 'factory'];

  return (
    <div className="grid grid-cols-2 gap-4">
      {roles.map((role) => {
        const isDisabled = disabledRoles.includes(role);
        return (
          <button
            key={role}
            onClick={() => !isDisabled && onRoleSelect(role)}
            disabled={isDisabled}
            className={cn(
              'group relative flex flex-col items-center gap-3 rounded-lg border-2 p-6 transition-all duration-300',
              isDisabled
                ? 'border-border/30 bg-muted/20 opacity-50 cursor-not-allowed'
                : selectedRole === role
                  ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                  : 'border-border bg-card/50 hover:border-primary/50 hover:bg-card'
            )}
          >
            <div
              className={cn(
                'rounded-full p-3 transition-colors',
                isDisabled
                  ? 'bg-muted/50 text-muted-foreground/50'
                  : selectedRole === role
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary'
              )}
            >
              {ROLE_ICONS[role]}
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-foreground">{ROLE_LABELS[role]}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {isDisabled ? 'Taken by another player' : ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
            {selectedRole === role && !isDisabled && (
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary animate-pulse" />
            )}
          </button>
        );
      })}
    </div>
  );
}
