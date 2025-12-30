import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin();
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-1 flex flex-col justify-center px-6 gap-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl mb-2">Transline</h1>
          <p className="text-[#9E9E9E]">Compliance in motion</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <h2>Driver Login</h2>
          
          <Input
            label="Email or Phone"
            type="text"
            placeholder="Enter your email or phone"
            value={email}
            onChange={setEmail}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={setPassword}
            required
          />

          <Button type="submit" variant="primary" fullWidth className="mt-4">
            Sign In
          </Button>

          <Button type="button" variant="text" fullWidth>
            Use OTP instead
          </Button>
        </form>
      </div>
    </div>
  );
}
