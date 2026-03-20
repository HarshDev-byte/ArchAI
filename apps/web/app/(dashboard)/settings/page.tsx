"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useUser } from "@/hooks/use-user"
import { User, Mail, Building, CreditCard, Zap } from "lucide-react"

export default function SettingsPage() {
  const { user, profile } = useUser()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || "",
    company_name: profile?.company_name || "",
  })

  const handleSave = async () => {
    // TODO: Implement profile update API call
    console.log("Saving profile:", formData)
    setIsEditing(false)
  }

  const getPlanColor = (plan?: string) => {
    switch (plan?.toLowerCase()) {
      case "enterprise":
        return "bg-amber-500/15 text-amber-400 border-amber-500/20"
      case "builder":
        return "bg-[#7F77DD]/15 text-[#7F77DD] border-[#7F77DD]/25"
      case "starter":
      default:
        return "bg-white/8 text-white/50 border-white/10"
    }
  }

  const designsRemaining = profile 
    ? Math.max(0, profile.designs_limit - profile.designs_used)
    : 0

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-white/40">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User size={20} />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-white/60 mb-1.5 block">
                Email Address
              </label>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                <Mail size={16} className="text-white/40" />
                <span className="text-sm text-white/80">{user?.email}</span>
                <Badge variant="outline" className="ml-auto">Verified</Badge>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-white/60 mb-1.5 block">
                Full Name
              </label>
              {isEditing ? (
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Enter your full name"
                />
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-sm text-white/80">
                    {profile?.full_name || "Not set"}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-white/60 mb-1.5 block">
                Company
              </label>
              {isEditing ? (
                <Input
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="Enter your company name"
                />
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                  <Building size={16} className="text-white/40" />
                  <span className="text-sm text-white/80">
                    {profile?.company_name || "Not set"}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              {isEditing ? (
                <>
                  <Button onClick={handleSave} className="flex-1">
                    Save Changes
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsEditing(false)
                      setFormData({
                        full_name: profile?.full_name || "",
                        company_name: profile?.company_name || "",
                      })
                    }}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)} className="flex-1">
                  Edit Profile
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plan & Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard size={20} />
              Plan & Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-white/60 mb-1.5 block">
                Current Plan
              </label>
              <div className="flex items-center gap-2">
                <Badge className={getPlanColor(profile?.plan)}>
                  {profile?.plan ? (profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)) : "Starter"}
                </Badge>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-white/60 mb-1.5 block">
                Design Credits
              </label>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                <Zap size={16} className="text-[#7F77DD]" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">
                      {designsRemaining} remaining
                    </span>
                    <span className="text-xs text-white/40">
                      of {profile?.designs_limit || 0} total
                    </span>
                  </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[#7F77DD] to-[#9990e8] transition-all duration-300"
                        style={{ 
                          width: `${(profile?.designs_limit && profile.designs_limit > 0) ? (designsRemaining / profile.designs_limit) * 100 : 0}%` 
                        }}
                      />
                    </div>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-white/60 mb-1.5 block">
                Designs Used
              </label>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                <span className="text-sm text-white/80">
                  {profile?.designs_used || 0} designs generated
                </span>
              </div>
            </div>

            <Button variant="outline" className="w-full">
              Upgrade Plan
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Account Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Account Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline">
              Download Data
            </Button>
            <Button variant="outline">
              Reset Password
            </Button>
            <Button variant="destructive" className="sm:ml-auto">
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}