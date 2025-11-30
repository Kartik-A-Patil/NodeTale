import React from 'react';
import { Project, Variable, VariableType } from '../../types';
import { Plus, X } from 'lucide-react';

interface VariablesListProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export const VariablesList: React.FC<VariablesListProps> = ({ project, setProject }) => {
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

  return (
    <div className="space-y-0">
       <div className="flex items-center justify-between px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
        <span>Global Variables</span>
        <button onClick={addVariable} className="hover:text-orange-500 transition-colors"><Plus size={14} /></button>
      </div>
      {project.variables.map((v, idx) => (
          <div key={v.id} className="group flex flex-col gap-2 px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
              <div className="flex items-center justify-between gap-2">
                  <input 
                      className="bg-transparent border-none text-zinc-200 font-medium text-xs w-full focus:outline-none placeholder-zinc-600"
                      value={v.name}
                      placeholder="variable_name"
                      onChange={(e) => {
                          const newVars = [...project.variables];
                          newVars[idx].name = e.target.value;
                          setProject({...project, variables: newVars});
                      }}
                  />
                   <button onClick={() => {
                       const newVars = project.variables.filter(vari => vari.id !== v.id);
                       setProject({...project, variables: newVars});
                   }} className="text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>
              </div>
              <div className="flex items-center gap-2">
                   <div className="relative">
                       <select 
                          className="appearance-none bg-zinc-900 text-zinc-500 text-[10px] font-bold uppercase px-2 py-1 rounded border border-zinc-800 hover:border-zinc-700 hover:text-zinc-300 focus:outline-none cursor-pointer transition-colors"
                          value={v.type}
                          onChange={(e) => {
                              const newVars = [...project.variables];
                              newVars[idx].type = e.target.value as VariableType;
                              if(e.target.value === VariableType.BOOLEAN) newVars[idx].value = false;
                              if(e.target.value === VariableType.NUMBER) newVars[idx].value = 0;
                              if(e.target.value === VariableType.STRING) newVars[idx].value = "";
                              setProject({...project, variables: newVars});
                          }}
                       >
                           <option value={VariableType.BOOLEAN}>Bool</option>
                           <option value={VariableType.NUMBER}>Num</option>
                           <option value={VariableType.STRING}>Str</option>
                       </select>
                   </div>
                   
                   {v.type === VariableType.BOOLEAN ? (
                       <button 
                          onClick={() => {
                              const newVars = [...project.variables];
                              newVars[idx].value = !newVars[idx].value;
                              setProject({...project, variables: newVars});
                          }}
                          className={`flex-1 text-left text-xs font-mono px-2 py-1 rounded transition-colors ${v.value ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}
                       >
                           {String(v.value)}
                       </button>
                   ) : (
                       <input 
                          className="flex-1 bg-zinc-900/50 text-zinc-300 text-xs font-mono px-2 py-1 rounded border border-transparent focus:border-zinc-700 focus:outline-none transition-colors placeholder-zinc-700"
                          value={String(v.value)}
                          placeholder="Value..."
                          type={v.type === VariableType.NUMBER ? 'number' : 'text'}
                          onChange={(e) => {
                              const newVars = [...project.variables];
                              newVars[idx].value = v.type === VariableType.NUMBER ? Number(e.target.value) : e.target.value;
                              setProject({...project, variables: newVars});
                          }}
                       />
                   )}
              </div>
          </div>
      ))}
    </div>
  );
};
