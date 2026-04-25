param(
  [string]$Host = "43.128.25.200",
  [string]$User = "ubuntu",
  [string]$AppDir = "/var/www/tongqu-growth-web"
)

$command = @"
cd $AppDir && \
chmod +x deploy/server-update.sh && \
bash deploy/server-update.sh
"@

ssh "$User@$Host" $command
