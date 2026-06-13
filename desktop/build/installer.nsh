; Extoboost NSIS Installer Overrides
; Included by electron-builder via build/installer.nsh

!macro preInit
  SetRegView 64
  WriteRegExpandStr HKLM "SOFTWARE\Extoboost" "InstallPath" "$INSTDIR"
  SetRegView 32
!macroend

!macro customHeader
  BrandingText "Extoboost Key System v${VERSION}"
!macroend

!macro customInstall
  DetailPrint "Extracting Extoboost Key System components..."
  CreateDirectory "$SMPROGRAMS\Extoboost"
  CreateShortCut "$SMPROGRAMS\Extoboost\Extoboost.lnk" "$INSTDIR\Extoboost.exe"
  CreateShortCut "$SMPROGRAMS\Extoboost\Uninstall Extoboost.lnk" "$INSTDIR\Uninstall Extoboost.exe"
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\Extoboost\Extoboost.lnk"
  Delete "$SMPROGRAMS\Extoboost\Uninstall Extoboost.lnk"
  RMDir "$SMPROGRAMS\Extoboost"
  DeleteRegKey HKLM "SOFTWARE\Extoboost"
!macroend
