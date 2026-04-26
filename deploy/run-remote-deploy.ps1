param(
  [string]$SshTarget = "tencent-new-project",
  [string]$ServerHost = "43.128.25.200",
  [string]$User = "ubuntu",
  [string]$AppDir = "/var/www/tongqu-growth-web"
)

$command = @"
cd $AppDir && \
chmod +x deploy/server-update.sh && \
bash deploy/server-update.sh
"@

$target = if ($SshTarget) { $SshTarget } else { "$User@$ServerHost" }

ssh $target $command
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
