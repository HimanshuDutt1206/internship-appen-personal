import { supabase } from './supabase'

export interface AuthUser {
  id: string
  email: string
  name?: string
}

export class AuthService {
  // Sign up with Supabase Auth (handles password hashing automatically)
  static async signUp(email: string, password: string, name: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name, // Store name in user metadata
          }
        }
      })

      if (error) throw error
      return { user: data.user, session: data.session }
    } catch (error) {
      console.error('Sign up error:', error)
      throw error
    }
  }

  // Sign in
  static async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
      return { user: data.user, session: data.session }
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    }
  }

  // Sign out
  static async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    }
  }

  // Get current user
  static async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      
      if (user) {
        return {
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.name
        }
      }
      return null
    } catch (error) {
      console.error('Get user error:', error)
      return null
    }
  }

  // Check if user is authenticated
  static async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser()
    return user !== null
  }

  // Listen to auth state changes
  static onAuthStateChange(callback: (user: AuthUser | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        callback({
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata?.name
        })
      } else {
        callback(null)
      }
    })
  }
} 