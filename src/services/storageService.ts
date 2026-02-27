import { Project } from '../types';
import { getStorageAdapter } from './storage';

// Wrappers that map 1:1 to StorageAdapter methods

export const saveProject = async (project: Project): Promise<void> => {
  return getStorageAdapter().saveProject(project);
};

export const loadProject = async (projectIdOrName: string): Promise<Project | null> => {
  return getStorageAdapter().loadProject(projectIdOrName);
};

export const getAllProjects = async (): Promise<Project[]> => {
  return getStorageAdapter().getAllProjects();
};

export const deleteProject = async (projectId: string): Promise<void> => {
  return getStorageAdapter().deleteProject(projectId);
};

export const checkProjectNameExists = async (name: string): Promise<boolean> => {
  const projects = await getStorageAdapter().getAllProjects();
  return projects.some(p => p.name === name);
};
