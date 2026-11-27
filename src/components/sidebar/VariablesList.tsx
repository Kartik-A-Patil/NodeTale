import React, { useState } from 'react';
import { Project, Variable, VariableType, ArrayValue, ObjectValue } from '../../models/story';
import { Check, ChevronDown, Pencil, Plus, X } from 'lucide-react';
import { VARIABLE_TYPES, variableTypeInfo } from '../variableTypes';
import { ArrayObjectEditorModal } from '../modals/ArrayObjectEditorModal';
import { Dialog } from '../ui/NativeDialog';
import { Switch } from '../ui/switch';
import { buttonGhostIcon, buttonPrimary, buttonSecondary } from '../ui/styles';
import { dropdownItem, dropdownPanel } from '../editor/editorStyles';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

const TYPES = VARIABLE_TYPES;
const typeInfo = variableTypeInfo;

function TypePicker({ value, onChange }: { value: VariableType; onChange: (type: VariableType) => void }) {
  const current = typeInfo(value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Type: ${current.label}`} title={current.label}
          className="flex h-8 shrink-0 items-center gap-1 rounded-md px-1.5 text-nt-ink-3 transition-colors hover:bg-nt-raised hover:text-nt-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-focus data-[state=open]:bg-nt-raised data-[state=open]:text-nt-ink">
          <current.icon size={14} />
          <ChevronDown size={12} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={`w-64 ${dropdownPanel}`}>
        {TYPES.map((t) => (
          <DropdownMenuItem key={t.type} className={`items-start gap-2.5 py-2 ${dropdownItem}`} onSelect={() => onChange(t.type)}>
            <t.icon size={15} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm">{t.label}</span>
              <span className="block text-xs text-nt-ink-3">{t.hint}</span>
            </span>
            {t.type === value && <Check size={14} className="mt-0.5 text-nt-accent" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface VariablesListProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export const VariablesList: React.FC<VariablesListProps> = ({ project, setProject }) => {
  const [editingVariable, setEditingVariable] = useState<Variable | null>(null);
  const [pendingTypeChange, setPendingTypeChange] = useState<{ id: string; newType: VariableType } | null>(null);

  const addVariable = () => {
    const newVar: Variable = {
      id: `var-${Date.now()}`,
      name: 'new_variable',
      type: VariableType.BOOLEAN,
      value: false
    };
    setProject(prev => ({
      ...prev,
      variables: [...prev.variables, newVar]
    }));
  };

  const updateVariable = (idx: number, field: keyof Variable, value: any) => {
    const newVars = [...project.variables];
    newVars[idx] = { ...newVars[idx], [field]: value };
    setProject({ ...project, variables: newVars });
  };

  const deleteVariable = (id: string) => {
    const newVars = project.variables.filter(v => v.id !== id);
    setProject({ ...project, variables: newVars });
  };

  const applyTypeChange = (id: string, newType: VariableType) => {
    setProject(prev => {
      const idx = prev.variables.findIndex(v => v.id === id);
      if (idx === -1) return prev;

      const updatedVariables = [...prev.variables];
      const updatedVar = { ...updatedVariables[idx], type: newType } as Variable;

      if (newType === VariableType.BOOLEAN) {
        updatedVar.value = false;
      } else if (newType === VariableType.NUMBER) {
        updatedVar.value = 0;
      } else if (newType === VariableType.STRING) {
        updatedVar.value = '';
      } else if (newType === VariableType.ARRAY) {
        updatedVar.value = { elementType: VariableType.STRING, elements: [] } as ArrayValue;
      } else if (newType === VariableType.OBJECT) {
        updatedVar.value = { keys: {} } as ObjectValue;
      }

      updatedVariables[idx] = updatedVar;
      return { ...prev, variables: updatedVariables };
    });
  };

  const handleTypeChange = (idx: number, newType: VariableType) => {
    const currentVar = project.variables[idx];
    
    // Check if there's existing data
    const hasData = 
      (currentVar.type === VariableType.STRING && currentVar.value !== '') ||
      (currentVar.type === VariableType.NUMBER && currentVar.value !== 0) ||
      (currentVar.type === VariableType.ARRAY && (currentVar.value as ArrayValue).elements.length > 0) ||
      (currentVar.type === VariableType.OBJECT && Object.keys((currentVar.value as ObjectValue).keys).length > 0);
    
    if (hasData) {
      setPendingTypeChange({ id: currentVar.id, newType });
      return;
    }

    applyTypeChange(currentVar.id, newType);
  };

  const confirmTypeChange = () => {
    if (!pendingTypeChange) return;
    applyTypeChange(pendingTypeChange.id, pendingTypeChange.newType);
    setPendingTypeChange(null);
  };

  const cancelTypeChange = () => setPendingTypeChange(null);

  const openEditor = (variable: Variable) => {
    setEditingVariable(variable);
  };

  const closeEditor = () => {
    setEditingVariable(null);
  };

  const handleEditorChange = (newValue: ArrayValue | ObjectValue) => {
    if (!editingVariable) return;
    const idx = project.variables.findIndex(v => v.id === editingVariable.id);
    if (idx !== -1) {
      updateVariable(idx, 'value', newValue);
      // Update the editingVariable state to reflect changes
      setEditingVariable({ ...editingVariable, value: newValue });
    }
  };

  const getDisplayValue = (variable: Variable): string => {
    if (variable.type === VariableType.ARRAY) {
      const count = (variable.value as ArrayValue).elements.length;
      return `${count} ${count === 1 ? 'item' : 'items'}`;
    } else if (variable.type === VariableType.OBJECT) {
      const count = Object.keys((variable.value as ObjectValue).keys).length;
      return `${count} ${count === 1 ? 'value' : 'values'}`;
    }
    return String(variable.value);
  };

  const pendingVariable = pendingTypeChange
    ? project.variables.find(v => v.id === pendingTypeChange.id)
    : null;

  const valueInput = 'h-8 w-full min-w-0 rounded-md border border-nt-line bg-nt-bg px-2 font-mono text-xs text-nt-ink placeholder:text-nt-ink-3 transition-colors hover:border-nt-line-strong focus-visible:border-nt-line-strong focus-visible:outline-none';

  return (
    <>
      <div className="flex items-center justify-between py-2 pl-4 pr-2">
        <span className="text-xs text-nt-ink-3">{project.variables.length} {project.variables.length === 1 ? 'variable' : 'variables'}, shared by every board</span>
        <button type="button" onClick={addVariable} className={buttonGhostIcon} aria-label="Add a variable" title="Add a variable"><Plus size={16} /></button>
      </div>

      {project.variables.length === 0 && (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-nt-ink-2">No variables yet.</p>
          <p className="mt-1 text-xs text-nt-ink-3">They remember what happened: gold found, doors opened.</p>
          <button type="button" onClick={addVariable} className={`${buttonSecondary} mt-4`}><Plus size={14} /> Add a variable</button>
        </div>
      )}

      <ul>
        {project.variables.map((v, idx) => (
          <li key={v.id} className="group border-t border-nt-line px-2 py-2">
            <div className="flex items-center gap-1">
              <TypePicker value={v.type} onChange={(type) => type !== v.type && handleTypeChange(idx, type)} />
              <input
                className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-1.5 font-mono text-sm text-nt-ink placeholder:text-nt-ink-3 hover:bg-nt-raised/60 focus-visible:bg-nt-raised focus-visible:outline-none"
                value={v.name}
                placeholder="variable_name"
                aria-label="Variable name"
                spellCheck={false}
                onChange={(e) => updateVariable(idx, 'name', e.target.value)}
              />
              <button type="button" onClick={() => deleteVariable(v.id)} aria-label={`Delete ${v.name}`} title="Delete"
                className={`${buttonGhostIcon} h-7 w-7 opacity-0 hover:text-nt-danger focus-visible:opacity-100 group-hover:opacity-100`}>
                <X size={14} />
              </button>
            </div>
            <div className="mt-1 pl-[3.25rem] pr-1">
              {v.type === VariableType.BOOLEAN ? (
                <label className="flex h-8 cursor-pointer items-center gap-2.5 text-xs text-nt-ink-2">
                  <Switch checked={!!v.value} onCheckedChange={(checked) => updateVariable(idx, 'value', checked)} aria-label={`${v.name} starts true`} />
                  <span className="font-mono">{String(!!v.value)}</span>
                </label>
              ) : v.type === VariableType.ARRAY || v.type === VariableType.OBJECT ? (
                <button type="button" onClick={() => openEditor(v)}
                  className={`${valueInput} flex items-center justify-between text-left text-nt-ink-2`}>
                  <span>{getDisplayValue(v)}</span>
                  <Pencil size={12} className="text-nt-ink-3" />
                </button>
              ) : (
                <input
                  className={valueInput}
                  value={String(v.value)}
                  placeholder={v.type === VariableType.NUMBER ? '0' : 'Starting text'}
                  aria-label={`${v.name} starting value`}
                  type={v.type === VariableType.NUMBER ? 'number' : 'text'}
                  onChange={(e) => updateVariable(idx, 'value', v.type === VariableType.NUMBER ? Number(e.target.value) : e.target.value)}
                />
              )}
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={!!(pendingVariable && pendingTypeChange)}
        onClose={cancelTypeChange}
        title="Change the type?"
        description={pendingVariable && pendingTypeChange && (
          <>Changing <span className="font-mono text-nt-ink">{pendingVariable.name}</span> from {typeInfo(pendingVariable.type).label} to {typeInfo(pendingTypeChange.newType).label} clears its starting value.</>
        )}
        actions={
          <>
            <button type="button" className={buttonSecondary} onClick={cancelTypeChange}>Cancel</button>
            <button type="button" className={buttonPrimary} onClick={confirmTypeChange}>Change type</button>
          </>
        }
      />

      {editingVariable && (editingVariable.type === VariableType.ARRAY || editingVariable.type === VariableType.OBJECT) && (
        <ArrayObjectEditorModal
          isOpen={true}
          onClose={closeEditor}
          variableName={editingVariable.name}
          variableType={editingVariable.type as VariableType.ARRAY | VariableType.OBJECT}
          value={editingVariable.value as ArrayValue | ObjectValue}
          onChange={handleEditorChange}
        />
      )}
    </>
  );
};
