#!/bin/bash

usage() {
cat <<EOF

  $0

  Usage: $0 --name=PKG_NAME --version=PKG_VERSION --module=MODULE
  Example: $0 --name=testserver --version=1.0 --module=all
EOF

}

for option in "$@"; do
  case "$option" in
    -h | --help)
      usage
      exit 0
    ;;
    --name=*)
      PKG_NAME=`echo "$option" | sed 's/--name=//'`
    ;;
    --version=*)
      PKG_VERSION=`echo "$option" | sed 's/--version=//'`
    ;;
    --module=*)
      MODULE=`echo "$option" | sed 's/--module=//'`
    ;;
  esac
done

if [ "x${PKG_NAME}" == "x" ] ; then
cat << EOF
  Package name should be specified.
  Usage:
EOF
    usage
    exit 1
fi

if [ "x${PKG_VERSION}" == "x" ] ; then
cat << EOF
  Some version number is necessary for the package building utility. Does not have to be meaningful. 
  Usage:
EOF
    usage
    exit 1
fi

if [ "x${MODULE}" == "x" ] ; then
cat << EOF
  Target module should be specified.
  Usage:
EOF
    usage
    exit 1
fi


PACKAGE_DIR="$(pwd)/${PKG_NAME}"
cat << EOF
Package directory: ${PACKAGE_DIR}
EOF

directory_setup() {
	_PKG_DIR=$1
	
  	mkdir -p ${_PKG_DIR}/DEBIAN
	mkdir -p ${_PKG_DIR}/usr/bin ${_PKG_DIR}/usr/lib/systemd/system
	mkdir -p ${_PKG_DIR}/etc/euro-office/documentserver
	mkdir -p ${_PKG_DIR}/var/www/euro-office/documentserver
}


prep_base() {
	_PKG_DIR=$1
	
	cp -r /var/www/euro-office/documentserver/license ${_PKG_DIR}/var/www/euro-office/documentserver
	cp -r /var/www/euro-office/documentserver/npm ${_PKG_DIR}/var/www/euro-office/documentserver
	cp -r /var/www/euro-office/documentserver/dictionaries ${_PKG_DIR}/var/www/euro-office/documentserver
	cp -r /var/www/euro-office/documentserver/document-templates ${_PKG_DIR}/var/www/euro-office/documentserver
	
	cp /var/www/euro-office/documentserver/LICENSE.txt ${_PKG_DIR}/var/www/euro-office/documentserver
	cp /var/www/euro-office/documentserver/3rd-Party.txt ${_PKG_DIR}/var/www/euro-office/documentserver
}

prep_server() {
	_PKG_DIR=$1
	
	cp /usr/bin/documentserver-* ${_PKG_DIR}/usr/bin/
	cp /usr/lib/systemd/system/ds-* ${_PKG_DIR}/usr/lib/systemd/system/
	cp -r /var/www/euro-office/documentserver/server ${_PKG_DIR}/var/www/euro-office/documentserver
	rm -r ${_PKG_DIR}/var/www/euro-office/documentserver/server/FileConverter
}

prep_web_apps() {
	_PKG_DIR=$1
	
	cp -r /var/www/euro-office/documentserver/web-apps ${_PKG_DIR}/var/www/euro-office/documentserver
}

prep_core_fonts() {
	_PKG_DIR=$1
	
	cp -r /var/www/euro-office/documentserver/core-fonts ${_PKG_DIR}/var/www/euro-office/documentserver
}

prep_sdkjs() {
	_PKG_DIR=$1
	
	cp -r /var/www/euro-office/documentserver/sdkjs ${_PKG_DIR}/var/www/euro-office/documentserver
	cp -r /var/www/euro-office/documentserver/sdkjs-plugins ${_PKG_DIR}/var/www/euro-office/documentserver
}

prep_core() {
	_PKG_DIR=$1
	
	cp -r /var/www/euro-office/documentserver/server/FileConverter ${_PKG_DIR}/var/www/euro-office/documentserver/server
}

prep_all() {
	prep_server $1
	prep_core $1
	prep_web_apps $1
	prep_sdkjs $1
	prep_core_fonts $1
}

create_control_file() {
	_PKG_DIR=$1
	_NAME=$2
	_VERSION=$3
	cat > ${_PKG_DIR}/DEBIAN/control <<-EOF
		Source: fork
		Section: unknown
		Priority: optional
		Maintainer: EuroOffice<>
		Build-Depends: debhelper-compat (= 13)
		Standards-Version: 4.6.1
		Homepage: <insert the upstream URL, if relevant>
		Rules-Requires-Root: no
		Package: ${_NAME}
		Version: ${_VERSION}
		Architecture: amd64
		Multi-Arch: foreign
		Depends:
		Description: 
		 Simple package for the EuroOffice document server
	EOF

}
  
directory_setup "${PACKAGE_DIR}"
prep_base "${PACKAGE_DIR}"
prep_all "${PACKAGE_DIR}"

create_control_file "${PACKAGE_DIR}" "${PKG_NAME}" "${PKG_VERSION}"

dpkg-deb --build "${PACKAGE_DIR}"

rm -r "${PACKAGE_DIR}"
