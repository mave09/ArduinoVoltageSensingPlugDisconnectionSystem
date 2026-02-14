# Generate self-signed certificate for local development
# Run this in PowerShell as Administrator

$cert = New-SelfSignedCertificate -DnsName "192.168.254.103", "localhost" -CertStoreLocation "cert:\LocalMachine\My" -NotAfter (Get-Date).AddYears(1)

# Export certificate
$pwd = ConvertTo-SecureString -String "password" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath ".\server.pfx" -Password $pwd

# Export public key for importing to devices
Export-Certificate -Cert $cert -FilePath ".\server.cer"

Write-Host "Certificate generated! Import server.cer to your mobile device's trusted certificates."
