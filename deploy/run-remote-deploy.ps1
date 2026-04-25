param(
  [string]$HostName = "43.128.25.200",
  [string]$User = "ubuntu",
  [string]$AppDir = "/var/www/tongqu-growth-web",
  [string]$SshConfig = ".\deploy\ssh-empty-config"
)

$command = @"
cd $AppDir && \
chmod +x deploy/server-update.sh && \
bash deploy/server-update.sh
"@

if (Test-Path $SshConfig) {
  ssh -F $SshConfig -o BatchMode=yes "$User@$HostName" $command
} else {
  ssh -o BatchMode=yes "$User@$HostName" $command
}
