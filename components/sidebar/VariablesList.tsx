import React, { useState } from 'react';
import { Project, Variable, VariableType, ArrayValue, ObjectValue } from '../../types';
import { Plus, X, Edit, AlertTriangle } from 'lucide-react';
import { ArrayObjectEditorModal } from './ArrayObjectEditorModal';

const typeLabels: Record<VariableType, string> = {
  [VariableType.BOOLEAN]: 'Boolean',
  [VariableType.NUMBER]: 'Number',
  [VariableType.STRING]: 'String',
  [VariableType.ARRAY]: 'Array',
  [VariableType.OBJECT]: 'Object'
};

interface TypeChangeConfirmModalProps {
  variableName: string;
  currentType: VariableType;
  nextType: VariableType;
  onCancel: () => void;
  onConfirm: () => void;
}

const TypeChangeConfirmModal: React.FC<TypeChangeConfirmModalProps> = ({
  variableName,
  currentType,
  nextType,
  onCancel,
  onConfirm
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md"
    onClick={onCancel}
  >
    <div
      className="w-full max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-950/90 p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30">
          <AlertTriangle size={18} />
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Type change</p>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-zinc-50">Reset this value?</h3>
            <p className="text-sm text-zinc-400">
              Changing the type for <span className="font-semibold text-zinc-100">{variableName || 'this variable'}</span> will clear its current value.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
            <span className="rounded-full bg-zinc-800 px-3 py-1 text-[11px] text-zinc-300">{typeLabels[currentType]}</span>
            <span className="text-zinc-600">→</span>
            <span className="rounded-full bg-orange-500/15 px-3 py-1 text-[11px] text-orange-300 ring-1 ring-orange-500/30">{typeLabels[nextType]}</span>
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs font-semibold text-zinc-300 rounded-lg border border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 text-xs font-semibold text-white rounded-lg bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-900/30 transition-colors"
        >
          Change type
        </button>
      </div>
    </div>
  </div>
);

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
      const arrayVal = variable.value as ArrayValue;
      return `[${arrayVal.elements.length} items]`;
    } else if (variable.type === VariableType.OBJECT) {
      const objVal = variable.value as ObjectValue;
      const keyCount = Object.keys(objVal.keys).length;
      return `{${keyCount} keys}`;
    }
    return String(variable.value);
  };

  const pendingVariable = pendingTypeChange
    ? project.variables.find(v => v.id === pendingTypeChange.id)
    : null;

  return (
    <>
      <div className="space-y-0">
         <div className="flex items-center justify-between px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
          <span>Global Variables</span>
          <button onClick={addVariable} className="hover:text-orange-500 transition-colors"><Plus size={14} /></button>
        </div>
        {project.variables.map((v, idx) => (
            <div key={v.id} className="group flex flex-col gap-2 px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors last:border-0">
                <div className="flex items-center justify-between gap-2">
                    <input 
                        className="bg-transparent border-none text-zinc-200 font-medium text-xs w-full focus:outline-none placeholder-zinc-600"
                        value={v.name}
                        placeholder="variable_name"
                        onChange={(e) => updateVariable(idx, 'name', e.target.value)}
                    />
                     <button 
                        onClick={() => deleteVariable(v.id)} 
                        className="text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={14}/>
                      </button>
                </div>
                <div className="flex items-center gap-2">
                     <div className="relative">
                         <select 
                            className="appearance-none bg-zinc-900 text-zinc-500 text-[10px] font-bold uppercase px-2 py-1 rounded border border-zinc-800 hover:border-zinc-700 hover:text-zinc-300 focus:outline-none cursor-pointer transition-colors"
                            value={v.type}
                            onChange={(e) => handleTypeChange(idx, e.target.value as VariableType)}
                         >
                             <option value={VariableType.BOOLEAN}>Bool</option>
                             <option value={VariableType.NUMBER}>Num</option>
                             <option value={VariableType.STRING}>Str</option>
                             <option value={VariableType.ARRAY}>Array</option>
                             <option value={VariableType.OBJECT}>Object</option>
                         </select>
                     </div>
                     
                     {v.type === VariableType.BOOLEAN ? (
                         <button 
                            onClick={() => updateVariable(idx, 'value', !v.value)}
                            className={`flex-1 text-left text-xs font-mono px-2 py-1 rounded transition-colors ${v.value ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}
                         >
                             {String(v.value)}
                         </button>
                     ) : v.type === VariableType.ARRAY || v.type === VariableType.OBJECT ? (
                         <button
                            onClick={() => openEditor(v)}
                            className="flex-1 flex items-center justify-between text-xs font-mono px-2 py-1 rounded bg-zinc-900/50 border border-zinc-800 hover:border-orange-500 text-zinc-400 hover:text-zinc-200 transition-colors"
                         >
                           <span>{getDisplayValue(v)}</span>
                           <Edit size={12} />
                         </button>
                     ) : (
                         <input 
                            className="flex-1 bg-zinc-900/50 text-zinc-300 text-xs font-mono px-2 py-1 rounded border border-transparent focus:border-zinc-700 focus:outline-none transition-colors placeholder-zinc-700"
                            value={String(v.value)}
                            placeholder="Value..."
                            type={v.type === VariableType.NUMBER ? 'number' : 'text'}
                            onChange={(e) => {
                                const val = v.type === VariableType.NUMBER ? Number(e.target.value) : e.target.value;
                                updateVariable(idx, 'value', val);
                            }}
                         />
                     )}
                </div>
            </div>
        ))}
      </div>

      {pendingVariable && pendingTypeChange && (
        <TypeChangeConfirmModal
          variableName={pendingVariable.name}
          currentType={pendingVariable.type}
          nextType={pendingTypeChange.newType}
          onCancel={cancelTypeChange}
          onConfirm={confirmTypeChange}
        />
      )}

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
