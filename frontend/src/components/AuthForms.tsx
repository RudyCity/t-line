import React from 'react';
import { Key, Lock } from 'lucide-react';
import { FormField, Input, Button } from './Form';

interface SetupFormProps {
  onSubmit: (e: React.FormEvent) => void;
  password: string;
  setPassword: (val: string) => void;
  error?: string | null;
}

export const SetupSecurityForm: React.FC<SetupFormProps> = ({ onSubmit, password, setPassword, error }) => {
  return (
    <div className="auth-wrapper">
      <form onSubmit={onSubmit} className="auth-card glass-panel">
        <div className="auth-header">
          <div className="welcome-icon-box">
            <Key size={28} />
          </div>
          <h1 className="auth-title">Setup Security</h1>
          <p className="auth-desc">Create a master password to secure your workspace backend and remote tunnels.</p>
        </div>
        <FormField label="Master Password" error={error}>
          <Input 
            type="password" 
            placeholder="Min. 6 characters" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
        </FormField>
        <Button type="submit">Initialize System</Button>
      </form>
    </div>
  );
};

interface LoginFormProps {
  onSubmit: (e: React.FormEvent) => void;
  password: string;
  setPassword: (val: string) => void;
  error?: string | null;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, password, setPassword, error }) => {
  return (
    <div className="auth-wrapper">
      <form onSubmit={onSubmit} className="auth-card glass-panel">
        <div className="auth-header">
          <div className="welcome-icon-box">
            <Lock size={28} />
          </div>
          <h1 className="auth-title">Enter Master Password</h1>
          <p className="auth-desc">Authenticating terminal and git worktree access.</p>
        </div>
        <FormField label="Master Password" error={error}>
          <Input 
            type="password" 
            placeholder="Master Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
        </FormField>
        <Button type="submit">Authenticate</Button>
      </form>
    </div>
  );
};
