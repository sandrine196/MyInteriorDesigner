"use client";
import { createContext, useContext } from "react";
import type { User } from "./api";

export type Session = {
  user: User | null;
  setUser: (u: User | null) => void;
};

export const SessionContext = createContext<Session>({
  user: null,
  setUser: () => {},
});

export function useSession() {
  return useContext(SessionContext);
}
