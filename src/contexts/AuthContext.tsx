import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'professor' | 'aluno';
  status: 'active' | 'inactive';
  student_registration?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role?: 'admin' | 'professor' | 'aluno') => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user profile
          setTimeout(async () => {
            try {
              const { data: profileData, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();
              
              if (error) {
                console.error('Error fetching profile:', error);
                // If no profile found, user exists in auth but not in users table
                if (error.code === 'PGRST116') {
                  console.log('User profile not found in users table');
                }
                setProfile(null);
                return;
              }
              
              if (profileData) {
                setProfile(profileData);
              }
            } catch (error) {
              console.error('Error in profile fetch:', error);
            }
          }, 0);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(async () => {
          try {
            const { data: profileData, error } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (error) {
              console.error('Error fetching profile on session check:', error);
              // If no profile found, user exists in auth but not in users table
              if (error.code === 'PGRST116') {
                console.log('User profile not found in users table during session check');
              }
              setProfile(null);
              setLoading(false);
              return;
            }
            
            if (profileData) {
              setProfile(profileData);
            }
            setLoading(false);
          } catch (error) {
            console.error('Error in session profile fetch:', error);
            setLoading(false);
          }
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, role: 'admin' | 'professor' | 'aluno' = 'aluno') => {
    try {
      // Store current session and user to restore later
      const currentSession = session;
      const currentUser = user;
      const currentProfile = profile;
      
      // Temporarily disable auth state listener during user creation
      const originalListener = supabase.auth.onAuthStateChange;
      
      // Create user using regular signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role
          }
        }
      });

      if (authError) {
        console.error('Auth error:', authError);
        return { error: authError };
      }

      // If user was created successfully, create the profile in the users table
      if (authData.user) {
        // Check if profile already exists to avoid duplicate insertion
        const { data: existingProfile } = await supabase
          .from('users')
          .select('id')
          .eq('id', authData.user.id)
          .single();

        if (!existingProfile) {
          const { error: profileError } = await supabase
            .from('users')
            .insert([{
              id: authData.user.id,
              email: email,
              full_name: fullName,
              role: role,
              status: 'active',
              student_registration: role === 'aluno' ? `STU${Date.now()}` : null
            }]);

          if (profileError) {
            console.error('Error creating profile:', profileError);
            // If it's a duplicate key error, that's fine - user already exists
            if (!profileError.message.includes('duplicate key')) {
              return { error: profileError };
            }
          }
        }
      }

      // Immediately restore the previous session to prevent login switching
      if (currentSession && currentUser && currentProfile) {
        try {
          await supabase.auth.setSession({
            access_token: currentSession.access_token,
            refresh_token: currentSession.refresh_token
          });
        } catch (error) {
          console.warn('Error restoring session after user creation:', error);
          // If session restore fails, just maintain the state without the session
        }
        
        // Force restore the state immediately
        setSession(currentSession);
        setUser(currentUser);
        setProfile(currentProfile);
      }

      return { error: null };
    } catch (error: unknown) {
      console.error('SignUp error:', error);
      return { error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = profile?.role === 'admin';
  const isTeacher = profile?.role === 'professor';
  const isStudent = profile?.role === 'aluno';

  const value = {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    isAdmin,
    isTeacher,
    isStudent,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}